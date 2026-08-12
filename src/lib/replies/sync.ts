import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { GoogleConnection, Mailbox } from "@prisma/client";
import { getGmailClient } from "@/lib/google/client";
import { enqueue, QUEUE_NAMES } from "@/lib/queue";
import {
  extractThreadReplies,
  type ReplyCandidate,
  type ThreadLike,
} from "@/lib/replies/extract";

/**
 * Reply sync.
 *
 * Scans active mailboxes for replies to messages we've sent. For each thread
 * that contains one of our sent messages we ask Gmail for the full thread,
 * pick out the messages from the lead (and delivery-failure notifications),
 * then:
 *
 *  - real replies  → Message(RECEIVED) + Reply(row) + stop-on-reply + sheet sync
 *  - auto-replies  → recorded as MessageEvent, sequence untouched
 *  - bounces       → Suppression(BOUNCE) + lead/campaign-lead suppressed
 *  - unsubscribes  → Suppression(UNSUBSCRIBE) + lead/campaign-lead suppressed
 *
 * Every inbound message is deduped on its unique `gmailMessageId`, so re-runs
 * (periodic ticks, repeated jobs) are safe.
 */

export interface SyncSummary {
  mailboxesScanned: number;
  replies: number;
  autoReplies: number;
  bounces: number;
  unsubscribes: number;
  skipped: number;
  errors: number;
  campaignsSynced: number;
}

function emptySummary(): SyncSummary {
  return {
    mailboxesScanned: 0,
    replies: 0,
    autoReplies: 0,
    bounces: 0,
    unsubscribes: 0,
    skipped: 0,
    errors: 0,
    campaignsSynced: 0,
  };
}

/** Job payload for the reply-sync worker (mailboxId currently unused — all). */
export interface SyncRepliesJob {
  mailboxId?: string;
}

type MailboxWithConnection = Mailbox & { googleConnection: GoogleConnection | null };

interface SentMessageRef {
  id: string;
  gmailThreadId: string | null;
  gmailMessageId: string | null;
  campaignLeadId: string | null;
  campaignId: string | null;
  leadId: string | null;
  sentAt: Date | null;
}

interface CandidateContext {
  threadId: string;
  /** Inbound messages older than the thread's first send are ignored. */
  minSentAt: Date;
  /** Outgoing message to mark BOUNCED when a bounce notification arrives. */
  bounceTargetId: string;
  campaignLead: {
    id: string;
    leadId: string;
    leadEmail: string;
    campaign: {
      id: string;
      userId: string;
      name: string;
      status: string;
      replyMode: string;
      settings: Prisma.JsonValue;
    };
  };
  mailbox: MailboxWithConnection;
}

type HandleKind =
  | "replies"
  | "autoReplies"
  | "bounces"
  | "unsubscribes"
  | "skipped";

/** Scan every active mailbox for new replies. Never throws per-mailbox. */
export async function syncRepliesForAllUsers(): Promise<SyncSummary> {
  const mailboxes = await prisma.mailbox.findMany({
    where: { status: "ACTIVE" },
    include: { googleConnection: true },
  });

  const total = emptySummary();
  total.mailboxesScanned = mailboxes.length;

  for (const mailbox of mailboxes) {
    if (!mailbox.googleConnection) continue;
    try {
      const sub = await syncMailboxReplies(mailbox);
      total.replies += sub.replies;
      total.autoReplies += sub.autoReplies;
      total.bounces += sub.bounces;
      total.unsubscribes += sub.unsubscribes;
      total.skipped += sub.skipped;
      total.errors += sub.errors;
      total.campaignsSynced += sub.campaignsSynced;
    } catch (error) {
      total.errors += 1;
      console.error(`[replies] sync failed for mailbox ${mailbox.id}:`, error);
    }
  }
  return total;
}

/** Sync one mailbox. Returns a per-mailbox summary. */
export async function syncMailboxReplies(
  mailbox: MailboxWithConnection,
): Promise<SyncSummary> {
  const summary = emptySummary();
  if (!mailbox.googleConnection) return summary;

  const gmail = await getGmailClient(mailbox.googleConnection);

  // Every sent message with a thread id is a handle on a conversation.
  const sent = await prisma.message.findMany({
    where: {
      mailboxId: mailbox.id,
      direction: "SENT",
      status: "SENT",
      gmailThreadId: { not: null },
    },
    select: {
      id: true,
      gmailThreadId: true,
      gmailMessageId: true,
      campaignLeadId: true,
      campaignId: true,
      leadId: true,
      sentAt: true,
    },
  });

  const threads = new Map<string, SentMessageRef[]>();
  for (const m of sent) {
    if (!m.gmailThreadId) continue;
    const refs = threads.get(m.gmailThreadId) ?? [];
    refs.push(m);
    threads.set(m.gmailThreadId, refs);
  }

  const campaignsToSync = new Set<string>();

  for (const [threadId, refs] of threads) {
    const ref = refs[0];
    if (!ref.campaignLeadId) continue; // sent outside a campaign — skip

    let thread: ThreadLike | undefined;
    try {
      const res = await gmail.users.threads.get({
        userId: "me",
        id: threadId,
        format: "full",
      });
      thread = res.data as ThreadLike;
    } catch (error) {
      summary.errors += 1;
      console.error(`[replies] thread ${threadId} fetch failed:`, error);
      continue;
    }

    const campaignLead = await prisma.campaignLead.findUnique({
      where: { id: ref.campaignLeadId },
      select: {
        id: true,
        leadId: true,
        lead: { select: { email: true } },
        campaign: {
          select: {
            id: true,
            userId: true,
            name: true,
            status: true,
            replyMode: true,
            settings: true,
          },
        },
      },
    });
    if (!campaignLead) continue;

    const ctx: CandidateContext = {
      threadId,
      minSentAt: new Date(
        Math.min(...refs.map((r) => (r.sentAt ?? new Date(0)).getTime())),
      ),
      // The most recent outgoing message is the one a bounce would target.
      bounceTargetId: [...refs].sort(
        (a, b) =>
          (b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0),
      )[0].id,
      campaignLead: {
        id: campaignLead.id,
        leadId: campaignLead.leadId,
        leadEmail: campaignLead.lead.email,
        campaign: campaignLead.campaign,
      },
      mailbox,
    };

    const candidates = extractThreadReplies(thread, {
      sentFromEmail: mailbox.emailAddress,
      leadEmails: [campaignLead.lead.email],
    });

    for (const candidate of candidates) {
      const { kind, campaignId } = await handleCandidate(candidate, ctx);
      if (campaignId) campaignsToSync.add(campaignId);
      summary[kind] += 1;
    }
  }

  for (const campaignId of campaignsToSync) {
    await enqueue(QUEUE_NAMES.sheetSync, "sync-campaign-status", { campaignId });
  }
  summary.campaignsSynced = campaignsToSync.size;
  return summary;
}

/** Process one candidate reply message. Returns how it was classified. */
async function handleCandidate(
  candidate: ReplyCandidate,
  ctx: CandidateContext,
): Promise<{ kind: HandleKind; campaignId?: string }> {
  const { parsed } = candidate;

  // Older than the first message we sent in this thread → ignore.
  if (
    parsed.internalDate != null &&
    parsed.internalDate < ctx.minSentAt.getTime() - 60_000
  ) {
    return { kind: "skipped" };
  }

  // Dedupe: an inbound Message with this gmailMessageId was already processed.
  const existing = await prisma.message.findFirst({
    where: { gmailMessageId: parsed.id },
    select: { id: true },
  });
  if (existing) return { kind: "skipped" };

  if (candidate.isBounce) {
    await recordBounce(candidate, ctx);
    return { kind: "bounces", campaignId: ctx.campaignLead.campaign.id };
  }
  if (candidate.isUnsubscribe) {
    await recordUnsubscribe(candidate, ctx);
    return { kind: "unsubscribes", campaignId: ctx.campaignLead.campaign.id };
  }
  if (candidate.isAutoReply) {
    await recordAutoReply(candidate, ctx);
    return { kind: "autoReplies" };
  }

  await recordReply(candidate, ctx);
  return { kind: "replies", campaignId: ctx.campaignLead.campaign.id };
}

function inboundData(candidate: ReplyCandidate, ctx: CandidateContext) {
  const { parsed } = candidate;
  return {
    campaignId: ctx.campaignLead.campaign.id,
    campaignLeadId: ctx.campaignLead.id,
    leadId: ctx.campaignLead.leadId,
    mailboxId: ctx.mailbox.id,
    direction: "RECEIVED" as const,
    subject: parsed.subject,
    body: parsed.body,
    gmailMessageId: parsed.id,
    gmailThreadId: ctx.threadId,
    sentAt: parsed.internalDate ? new Date(parsed.internalDate) : new Date(),
  };
}

async function recordAutoReply(candidate: ReplyCandidate, ctx: CandidateContext) {
  const { parsed } = candidate;
  const message = await prisma.message.create({
    data: { ...inboundData(candidate, ctx), status: "DELIVERED" },
  });
  await prisma.messageEvent.create({
    data: {
      messageId: message.id,
      type: "AUTO_REPLY",
      data: { gmailMessageId: parsed.id, threadId: ctx.threadId, from: parsed.fromEmail },
      occurredAt: new Date(),
    },
  });
  await logActivity(
    ctx.campaignLead.campaign.userId,
    "AUTO_REPLY_RECEIVED",
    `Auto-reply (${parsed.subject || "no subject"}) from ${parsed.fromEmail} on "${ctx.campaignLead.campaign.name}" — sequence continues`,
    { campaignId: ctx.campaignLead.campaign.id, leadId: ctx.campaignLead.leadId, gmailMessageId: parsed.id },
  );
}

async function recordBounce(candidate: ReplyCandidate, ctx: CandidateContext) {
  const { parsed } = candidate;
  const campaign = ctx.campaignLead.campaign;

  await prisma.message.create({
    data: { ...inboundData(candidate, ctx), status: "BOUNCED" },
  });
  await prisma.messageEvent.create({
    data: {
      messageId: ctx.bounceTargetId,
      type: "BOUNCED",
      data: { gmailMessageId: parsed.id, threadId: ctx.threadId, from: parsed.fromEmail },
      occurredAt: new Date(),
    },
  });
  await prisma.message.update({
    where: { id: ctx.bounceTargetId },
    data: { status: "BOUNCED", error: "Bounce notification received", updatedAt: new Date() },
  });

  await suppressLead(ctx, "BOUNCE", "gmail-sync");
  await prisma.campaignLead.update({
    where: { id: ctx.campaignLead.id },
    data: { status: "BOUNCED", isSuppressed: true, nextActionAt: null, updatedAt: new Date() },
  });
  await prisma.lead.update({
    where: { id: ctx.campaignLead.leadId },
    data: { suppressionStatus: "SUPPRESSED", status: "BOUNCED" },
  });

  await logActivity(
    campaign.userId,
    "EMAIL_BOUNCED",
    `Email to ${ctx.campaignLead.leadEmail} bounced — lead suppressed`,
    { campaignId: campaign.id, leadId: ctx.campaignLead.leadId, gmailMessageId: parsed.id },
  );
}

async function recordUnsubscribe(candidate: ReplyCandidate, ctx: CandidateContext) {
  const { parsed } = candidate;
  const campaign = ctx.campaignLead.campaign;

  await prisma.message.create({
    data: { ...inboundData(candidate, ctx), status: "DELIVERED" },
  });
  await prisma.messageEvent.create({
    data: {
      messageId: ctx.bounceTargetId,
      type: "UNSUBSCRIBE",
      data: { gmailMessageId: parsed.id, threadId: ctx.threadId, from: parsed.fromEmail },
      occurredAt: new Date(),
    },
  });

  await suppressLead(ctx, "UNSUBSCRIBE", "gmail-sync");
  await prisma.campaignLead.update({
    where: { id: ctx.campaignLead.id },
    data: { status: "UNSUBSCRIBED", isSuppressed: true, nextActionAt: null, updatedAt: new Date() },
  });
  await prisma.lead.update({
    where: { id: ctx.campaignLead.leadId },
    data: { suppressionStatus: "SUPPRESSED", status: "UNSUBSCRIBED" },
  });

  await logActivity(
    campaign.userId,
    "UNSUBSCRIBED",
    `${ctx.campaignLead.leadEmail} unsubscribed — lead suppressed`,
    { campaignId: campaign.id, leadId: ctx.campaignLead.leadId, gmailMessageId: parsed.id },
  );
}

async function recordReply(candidate: ReplyCandidate, ctx: CandidateContext) {
  const { parsed } = candidate;
  const campaign = ctx.campaignLead.campaign;

  const message = await prisma.message.create({
    data: { ...inboundData(candidate, ctx), status: "DELIVERED" },
  });
  await prisma.messageEvent.create({
    data: {
      messageId: message.id,
      type: "REPLY",
      data: { gmailMessageId: parsed.id, threadId: ctx.threadId, from: parsed.fromEmail },
      occurredAt: new Date(),
    },
  });
  const reply = await prisma.reply.create({
    data: {
      messageId: message.id,
      leadId: ctx.campaignLead.leadId,
      campaignId: campaign.id,
      threadId: ctx.threadId,
      gmailMessageId: parsed.id,
      senderEmail: parsed.fromEmail,
      subject: parsed.subject,
      body: parsed.body,
      receivedAt: parsed.internalDate ? new Date(parsed.internalDate) : new Date(),
      status: "NEW", // Phase 6 (AI) classifies this reply and drafts a response.
    },
  });

  const stopOnReply =
    (campaign.settings as { stopOnReply?: boolean } | null)?.stopOnReply ?? true;

  const leadUpdate: Prisma.CampaignLeadUpdateInput = {
    repliesCount: { increment: 1 },
    updatedAt: new Date(),
  };
  if (stopOnReply) {
    leadUpdate.status = "REPLIED";
    leadUpdate.nextActionAt = null; // cancels any scheduled follow-up
  }
  await prisma.campaignLead.update({
    where: { id: ctx.campaignLead.id },
    data: leadUpdate,
  });
  await prisma.lead.update({
    where: { id: ctx.campaignLead.leadId },
    data: { lastReplyAt: new Date(), status: "REPLIED", aiIntent: null, aiConfidence: null },
  });

  await logActivity(
    campaign.userId,
    "REPLY_RECEIVED",
    `Reply from ${parsed.fromEmail} on "${campaign.name}"`,
    { replyId: reply.id, campaignId: campaign.id, leadId: ctx.campaignLead.leadId, gmailMessageId: parsed.id },
  );
}

/** Insert (or refresh) a suppression row for the campaign lead's email. */
async function suppressLead(
  ctx: CandidateContext,
  reason: "BOUNCE" | "UNSUBSCRIBE",
  source: string,
): Promise<void> {
  await prisma.suppression.upsert({
    where: { userId_email: { userId: ctx.campaignLead.campaign.userId, email: ctx.campaignLead.leadEmail } },
    create: {
      userId: ctx.campaignLead.campaign.userId,
      email: ctx.campaignLead.leadEmail,
      leadId: ctx.campaignLead.leadId,
      reason,
      source,
    },
    update: { leadId: ctx.campaignLead.leadId, reason },
  });
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
    console.error("[replies] activity log failed:", error);
  }
}
