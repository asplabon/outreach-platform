import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { getGmailClient } from "@/lib/google/client";
import {
  buildRenderContext,
  formatSender,
  renderMessage,
} from "@/lib/email/render";
import { buildRawMessage, type SendResult } from "@/lib/email/send";
import { computeNextActionAt } from "@/lib/email/schedule";
import { enqueue, QUEUE_NAMES, type QueueJob } from "@/lib/queue";

/**
 * Follow-up engine (Phase 5).
 *
 * - `processDueFollowUps()` finds campaign leads whose scheduled follow-up is
 *   due and enqueues the send. Runs on a schedule (dev interval in-process,
 *   repeatable BullMQ job in Redis mode).
 * - `sendFollowUpMessage()` is the worker handler: renders the step, sends it
 *   into the existing thread, and either schedules the next step or completes
 *   the campaign lead.
 */

/** Job payload for a single follow-up send. */
export interface SendFollowUpJob {
  campaignLeadId: string;
  /** The sequence step (order) to send. */
  stepOrder: number;
}

export interface ProcessResult {
  due: number;
  dispatched: number;
  completed: number;
  errors: number;
}

/** Campaign leads whose next follow-up is due right now. */
export async function processDueFollowUps(): Promise<ProcessResult> {
  const result: ProcessResult = { due: 0, dispatched: 0, completed: 0, errors: 0 };
  const now = new Date();

  const due = await prisma.campaignLead.findMany({
    where: {
      status: "FOLLOW_UP_SCHEDULED",
      nextActionAt: { not: null, lte: now },
      isSuppressed: false,
    },
    select: { id: true },
  });
  result.due = due.length;

  for (const { id } of due) {
    try {
      const cl = await prisma.campaignLead.findUnique({
        where: { id },
        include: {
          campaign: {
            include: { sequence: { include: { steps: { orderBy: { order: "asc" } } } } },
          },
        },
      });
      if (!cl || cl.campaign.status !== "RUNNING") continue;

      const steps = cl.campaign.sequence?.steps ?? [];
      const step = steps.find((s) => s.order === cl.currentStepIndex);
      if (!step) {
        // Nothing left to send — campaign lead is complete.
        await prisma.campaignLead.update({
          where: { id },
          data: { status: "COMPLETED", nextActionAt: null, updatedAt: new Date() },
        });
        result.completed += 1;
        continue;
      }

      await enqueue<SendFollowUpJob>(
        QUEUE_NAMES.email,
        "send-followup",
        { campaignLeadId: id, stepOrder: step.order },
        { jobId: `${id}:FOLLOWUP:${step.order}` },
      );
      result.dispatched += 1;
    } catch (error) {
      result.errors += 1;
      console.error(`[followup] dispatch failed for campaign lead ${id}:`, error);
    }
  }
  return result;
}

/**
 * Send one follow-up step into the lead's existing thread. Idempotent on
 * `(campaign lead, step)` via a unique idempotency key; stale or superseded
 * jobs (lead replied / stopped / current step advanced) are skipped.
 */
export async function sendFollowUpMessage(
  job: QueueJob<SendFollowUpJob>,
): Promise<SendResult> {
  const { campaignLeadId, stepOrder } = job.data;

  const campaignLead = await prisma.campaignLead.findUnique({
    where: { id: campaignLeadId },
    include: {
      lead: true,
      campaign: {
        include: {
          mailbox: { include: { googleConnection: true } },
          sequence: { include: { steps: { orderBy: { order: "asc" } } } },
        },
      },
    },
  });
  if (!campaignLead) throw new Error(`CampaignLead ${campaignLeadId} not found`);
  const campaign = campaignLead.campaign;

  // A campaign that stopped since scheduling → no dispatch.
  if (campaign.status !== "RUNNING") {
    return { messageId: "", skipped: true, reason: `campaign ${campaign.status}` };
  }
  if (
    campaignLead.isSuppressed ||
    campaignLead.lead.suppressionStatus !== "ACTIVE"
  ) {
    return { messageId: "", skipped: true, reason: "suppressed" };
  }
  if (campaignLead.status === "REPLIED" || campaignLead.status === "STOPPED") {
    return { messageId: "", skipped: true, reason: campaignLead.status };
  }
  // This step is no longer the one in flight (a newer one already went out).
  if (campaignLead.currentStepIndex !== stepOrder) {
    return { messageId: "", skipped: true, reason: "stale step" };
  }

  const steps = campaign.sequence?.steps ?? [];
  const step = steps.find((s) => s.order === stepOrder);
  if (!step) {
    return { messageId: "", skipped: true, reason: "step missing" };
  }

  const mailbox = campaign.mailbox;
  if (!mailbox || mailbox.status !== "ACTIVE" || !mailbox.googleConnection) {
    throw new Error(`Mailbox for campaign ${campaign.id} is not active`);
  }

  // Resolve step content: template first, inline fallback otherwise.
  let subjectSrc = step.subject ?? "";
  let bodySrc = step.body ?? "";
  if (step.templateId) {
    const template = await prisma.emailTemplate.findUnique({
      where: { id: step.templateId },
      select: { subject: true, body: true },
    });
    if (template) {
      subjectSrc = template.subject;
      bodySrc = template.body;
    }
  }
  if (!subjectSrc && !bodySrc) {
    throw new Error(`Follow-up step ${stepOrder} has no content`);
  }

  const user = await prisma.user.findUnique({
    where: { id: campaign.userId },
    select: { name: true, email: true },
  });
  const ctx = buildRenderContext(campaignLead.lead, mailbox, user);
  const rendered = renderMessage({ subject: subjectSrc, body: bodySrc }, ctx);
  const subject = /^re:/i.test(rendered.subject)
    ? rendered.subject
    : `Re: ${rendered.subject}`;
  const from = formatSender(ctx.sender);

  // Send into the existing thread (Gmail threads the message for us).
  const lastSent = await prisma.message.findFirst({
    where: {
      campaignLeadId,
      direction: "SENT",
      gmailThreadId: { not: null },
    },
    orderBy: { sentAt: "desc" },
    select: { gmailThreadId: true },
  });
  const threadId = lastSent?.gmailThreadId ?? undefined;

  const idempotencyKey = `${campaignLeadId}:FOLLOWUP:${stepOrder}`;
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

  const message = await prisma.message.create({
    data: {
      campaignId: campaign.id,
      campaignLeadId,
      leadId: campaignLead.leadId,
      mailboxId: mailbox.id,
      direction: "SENT",
      subject,
      body: rendered.body,
      status: "SENDING",
      idempotencyKey,
      scheduledAt: new Date(),
    },
  });

  const gmail = await getGmailClient(mailbox.googleConnection);
  let gmailMessageId: string | undefined;
  let gmailThreadId: string | undefined;
  try {
    const raw = buildRawMessage({
      from,
      to: campaignLead.lead.email,
      subject,
      body: rendered.body,
    });
    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: threadId ? { raw, threadId } : { raw },
    });
    gmailMessageId = res.data.id ?? undefined;
    gmailThreadId = res.data.threadId ?? undefined;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown Gmail error";
    await prisma.message.update({
      where: { id: message.id },
      data: { status: "FAILED", error: msg, retries: { increment: 1 } },
    });
    await logActivity(
      campaign.userId,
      "EMAIL_FAILED",
      `Follow-up to ${campaignLead.lead.email} failed to send`,
      { messageId: message.id, error: msg, campaignId: campaign.id },
    );
    throw new Error(msg);
  }

  const sentAt = new Date();
  await prisma.message.update({
    where: { id: message.id },
    data: {
      status: "SENT",
      gmailMessageId,
      gmailThreadId,
      sentAt,
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

  // Schedule the next step, or complete the campaign lead.
  const currentIndex = steps.findIndex((s) => s.order === stepOrder);
  const nextStep = steps[currentIndex + 1];
  const settings = {
    timezone: campaign.timezone,
    workingHoursStart: campaign.workingHoursStart,
    workingHoursEnd: campaign.workingHoursEnd,
  };
  await prisma.campaignLead.update({
    where: { id: campaignLeadId },
    data: nextStep
      ? {
          status: "FOLLOW_UP_SCHEDULED",
          currentStepIndex: nextStep.order,
          nextActionAt: computeNextActionAt({
            lastSentAt: sentAt,
            delayDays: nextStep.delayDays,
            settings,
          }),
          lastSentAt: sentAt,
          lastMessageId: message.id,
          updatedAt: new Date(),
        }
      : {
          status: "COMPLETED",
          currentStepIndex: steps.length,
          nextActionAt: null,
          lastSentAt: sentAt,
          lastMessageId: message.id,
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
    `Follow-up (step ${stepOrder + 1}) sent to ${campaignLead.lead.email} (${campaign.name})`,
    { messageId: message.id, gmailMessageId, campaignId: campaign.id, stepOrder },
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
    console.error("[followup] activity log failed:", error);
  }
}
