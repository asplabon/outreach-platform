import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { getGmailClient } from "@/lib/google/client";
import {
  buildRenderContext,
  formatSender,
  renderMessage,
} from "@/lib/email/render";
import { computeNextActionAt } from "@/lib/email/schedule";
import type { QueueJob } from "@/lib/queue";

/** Job payload for a single initial email send. */
export interface SendInitialJob {
  campaignLeadId: string;
}

export interface SendResult {
  messageId: string;
  gmailMessageId?: string;
  skipped?: boolean;
  reason?: string;
}

/** RFC 2047 encode a subject header when it contains non-ASCII bytes. */
function encodeSubject(subject: string): string {
  if (/[\x80-￿]/.test(subject)) {
    return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
  }
  return subject;
}

/** Build an RFC 5322 message and return its base64url-safe raw form. */
export function buildRawMessage(opts: {
  from: string;
  to: string;
  subject: string;
  body: string;
}): string {
  const headers = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${encodeSubject(opts.subject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: 8bit`,
    `Date: ${new Date().toUTCString()}`,
  ];
  const raw = `${headers.join("\r\n")}\r\n\r\n${opts.body}`.replace(/\r?\n/g, "\r\n");
  return Buffer.from(raw, "utf8").toString("base64url");
}

/**
 * Load the full record set a send needs: campaign (mailbox + google
 * connection + initial template + user) and the campaign lead with its lead.
 */
async function loadSendContext(campaignLeadId: string) {
  const campaignLead = await prisma.campaignLead.findUnique({
    where: { id: campaignLeadId },
    include: { lead: true },
  });
  if (!campaignLead) {
    throw new Error(`CampaignLead ${campaignLeadId} not found`);
  }
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignLead.campaignId },
    include: {
      mailbox: { include: { googleConnection: true } },
      initialTemplate: true,
      sequence: { include: { steps: { orderBy: { order: "asc" } } } },
    },
  });
  if (!campaign) {
    throw new Error(`Campaign ${campaignLead.campaignId} not found`);
  }
  const user = await prisma.user.findUnique({
    where: { id: campaign.userId },
    select: { name: true, email: true },
  });
  return { campaignLead, campaign, user };
}

/**
 * Send the initial (step 0) email for one campaign lead.
 *
 * Idempotent: a Message row is created with an idempotency key unique to
 * (campaign lead, step). If one already exists (any terminal state) this is a
 * no-op, so re-running a launch — or a delayed job that fires after a retry —
 * can never double-send.
 */
export async function sendInitialMessage(
  job: QueueJob<SendInitialJob>,
): Promise<SendResult> {
  const { campaignLeadId } = job.data;
  const { campaignLead, campaign, user } = await loadSendContext(campaignLeadId);

  // A campaign that stopped (paused/completed/archived) since scheduling means
  // this job should not dispatch anything further.
  if (campaign.status !== "RUNNING") {
    return { messageId: "", skipped: true, reason: `campaign ${campaign.status}` };
  }

  // Suppressed leads are never contacted.
  if (
    campaignLead.isSuppressed ||
    campaignLead.lead.suppressionStatus !== "ACTIVE" ||
    campaignLead.status === "SUPPRESSED"
  ) {
    await prisma.campaignLead.update({
      where: { id: campaignLeadId },
      data: { status: "SUPPRESSED", updatedAt: new Date() },
    });
    return { messageId: "", skipped: true, reason: "suppressed" };
  }

  // Already sent / scheduled — idempotent guard (also covers follow-ups later).
  if (
    campaignLead.status === "SENT" ||
    campaignLead.status === "FOLLOW_UP_SCHEDULED" ||
    campaignLead.status === "REPLIED" ||
    campaignLead.status === "STOPPED"
  ) {
    return { messageId: "", skipped: true, reason: campaignLead.status };
  }

  const mailbox = campaign.mailbox;
  if (!mailbox || mailbox.status !== "ACTIVE" || !mailbox.googleConnection) {
    throw new Error(`Mailbox for campaign ${campaign.id} is not active`);
  }
  const template = campaign.initialTemplate;
  if (!template) {
    throw new Error(`Campaign ${campaign.id} has no initial template`);
  }

  const idempotencyKey = `${campaignLeadId}:INITIAL`;

  // Bespoke message already created for this send (in flight or failed)?
  const existing = await prisma.message.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    return {
      messageId: existing.id,
      gmailMessageId: existing.gmailMessageId ?? undefined,
      skipped: true,
      reason: `message ${existing.status}`,
    };
  }

  // Personalize subject + body.
  const ctx = buildRenderContext(campaignLead.lead, mailbox, user);
  const { subject, body } = renderMessage(
    { subject: template.subject, body: template.body },
    ctx,
  );
  const from = formatSender(ctx.sender);

  const message = await prisma.message.create({
    data: {
      campaignId: campaign.id,
      campaignLeadId,
      leadId: campaignLead.leadId,
      mailboxId: mailbox.id,
      direction: "SENT",
      subject,
      body,
      status: "SENDING",
      idempotencyKey,
      scheduledAt: new Date(),
    },
  });

  const gmail = await getGmailClient(mailbox.googleConnection);
  let gmailMessageId: string | undefined;
  let gmailThreadId: string | undefined;

  try {
    const raw = buildRawMessage({ from, to: campaignLead.lead.email, subject, body });
    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });
    gmailMessageId = res.data.id ?? undefined;
    gmailThreadId = res.data.threadId ?? undefined;
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Unknown Gmail error";
    // Mark the message failed and let BullMQ backoff retry. Re-throw so the
    // job is attempted again (in-process mode logs and swallows).
    await prisma.message.update({
      where: { id: message.id },
      data: { status: "FAILED", error: msg, retries: { increment: 1 } },
    });
    await logActivity(
      campaign.userId,
      "EMAIL_FAILED",
      `Initial email to ${campaignLead.lead.email} failed to send`,
      { messageId: message.id, error: msg, campaignId: campaign.id },
    );
    throw new Error(msg);
  }

  // Success — write the delivery records.
  await prisma.message.update({
    where: { id: message.id },
    data: {
      status: "SENT",
      gmailMessageId,
      gmailThreadId,
      sentAt: new Date(),
      updatedAt: new Date(),
    },
  });
  await prisma.messageEvent.create({
    data: {
      messageId: message.id,
      type: "SENT",
      data: { gmailMessageId, gmailThreadId },
      occurredAt: new Date(),
    },
  });
  const sentAt = new Date();
  // Schedule the first follow-up when the campaign has a sequence.
  const steps = campaign.sequence?.steps ?? [];
  const firstFollowUp = steps[0] ?? null;
  await prisma.campaignLead.update({
    where: { id: campaignLeadId },
    data: {
      status: firstFollowUp ? "FOLLOW_UP_SCHEDULED" : "SENT",
      lastSentAt: sentAt,
      lastMessageId: message.id,
      currentStepIndex: 0,
      nextActionAt: firstFollowUp
        ? computeNextActionAt({
            lastSentAt: sentAt,
            delayDays: firstFollowUp.delayDays,
            settings: {
              timezone: campaign.timezone,
              workingHoursStart: campaign.workingHoursStart,
              workingHoursEnd: campaign.workingHoursEnd,
            },
          })
        : null,
      updatedAt: new Date(),
    },
  });
  await prisma.lead.update({
    where: { id: campaignLead.leadId },
    data: { lastContactedAt: sentAt, status: "CONTACTED" },
  });
  await logActivity(
    campaign.userId,
    "EMAIL_SENT",
    `Initial email sent to ${campaignLead.lead.email} (${campaign.name})`,
    { messageId: message.id, gmailMessageId, campaignId: campaign.id },
  );

  return { messageId: message.id, gmailMessageId };
}

/** Append an activity-log line (best-effort, never throws). */
async function logActivity(
  userId: string,
  type: string,
  message: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        type,
        message,
        metadata: metadata as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    console.error("[email] activity log failed:", error);
  }
}