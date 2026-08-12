import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { getGmailClient } from "@/lib/google/client";
import { formatSender, buildRenderContext } from "@/lib/email/render";
import { buildRawMessage } from "@/lib/email/send";
import { enqueue, QUEUE_NAMES } from "@/lib/queue";
import { getAiProvider } from "@/lib/ai/provider";
import {
  AUTO_REPLY_MIN_CONFIDENCE,
  DEFAULT_AUTO_REPLY_INTENTS,
  type ReplyIntent,
} from "@/lib/ai/types";

/**
 * AI reply pipeline (Phase 6).
 *
 * 1. `processPendingReplies()` — finds inbound replies waiting for AI and
 *    enqueues a `ai:process-reply` job per reply.
 * 2. `processReply()` — classifies the reply (Zod-validated), records an
 *    AiRun, generates a draft (AiReply), and decides what happens next:
 *      - ESCALATED    — unsubscribe / not-interested / model-flagged: human
 *                       must review; never auto-reply.
 *      - SENT         — AUTO mode + allowed intent + confidence high: the
 *                       draft is sent automatically, in-thread.
 *      - PENDING_REVIEW — everything else waits on the AI Replies review page.
 * 3. `sendAiReply()` / `rejectAiReply()` — the human actions from the review
 *    page (also used by auto-send).
 */

/** Job payload for processing one reply. */
export interface ProcessReplyJob {
  replyId: string;
}

export interface ProcessReplyResult {
  replyId: string;
  status: string;
  intent?: string;
}

export interface ProcessPendingResult {
  queued: number;
  skipped: number;
}

export interface RouteDecision {
  status: "SENT" | "ESCALATED" | "PENDING_REVIEW";
  /** Why a human must see it, or null when it may auto-send / proceed. */
  escalation: string | null;
}

/**
 * Decide what happens to a classified + drafted reply (pure, unit-testable).
 *
 * - SENT            — AUTO mode, allowed intent, not blocked, confidence high.
 * - ESCALATED       — blocked from auto-reply (unsubscribe / not-interested /
 *                     model-flagged); a human must review before anything sends.
 * - PENDING_REVIEW  — APPROVAL mode (or confidence too low): waits on the
 *                     review page.
 */
export function decideSendRoute(opts: {
  isAutoReplyCandidate: boolean;
  escalation: string | null;
  replyMode: "APPROVAL" | "AUTO";
  intent: ReplyIntent;
  allowedIntents: ReplyIntent[];
  confidence: number;
}): RouteDecision {
  const autoBlocked = opts.isAutoReplyCandidate === false || opts.escalation !== null;
  const shouldAutoSend =
    !autoBlocked &&
    opts.replyMode === "AUTO" &&
    opts.allowedIntents.includes(opts.intent) &&
    opts.confidence >= AUTO_REPLY_MIN_CONFIDENCE;
  return {
    status: shouldAutoSend ? "SENT" : autoBlocked ? "ESCALATED" : "PENDING_REVIEW",
    escalation: opts.escalation ?? (autoBlocked ? "Blocked from auto-reply — requires review" : null),
  };
}

/** Inbound replies waiting on AI. */
export async function processPendingReplies(): Promise<ProcessPendingResult> {
  const waiting = await prisma.reply.findMany({
    where: {
      OR: [
        { status: "NEW" },
        { status: "CLASSIFIED", aiReply: { is: null } },
      ],
    },
    select: { id: true },
    orderBy: { receivedAt: "asc" },
    take: 50,
  });

  let queued = 0;
  for (const { id } of waiting) {
    await enqueue<ProcessReplyJob>(
      QUEUE_NAMES.ai,
      "process-reply",
      { replyId: id },
      { jobId: `${id}:AI`, attempts: 2, backoffMs: 2_000 },
    );
    queued += 1;
  }
  return { queued, skipped: waiting.length - queued };
}

/** Classify + draft one reply, then route it to auto-send or review. */
export async function processReply(replyId: string): Promise<ProcessReplyResult> {
  const reply = await prisma.reply.findUnique({
    where: { id: replyId },
    include: { lead: true, message: true, campaign: true, aiReply: true },
  });
  if (!reply) throw new Error(`Reply ${replyId} not found`);
  if (reply.status === "SENT" || reply.status === "ESCALATED" || reply.status === "IGNORED") {
    return { replyId, status: reply.status };
  }
  if (reply.aiReply) {
    return { replyId, status: reply.aiReply.status };
  }

  const userId = reply.lead.userId;
  const campaign = reply.campaign;
  const campaignInstructions = readCampaignInstructions(campaign?.settings);
  const provider = await getAiProvider();

  // 1) Classify.
  const classification = await provider.classifyReply({
    replySubject: reply.subject ?? "",
    replyBody: reply.body ?? "",
    leadName: reply.lead.name ?? reply.lead.firstName ?? reply.lead.email,
    leadCompany: reply.lead.company,
    campaignName: campaign?.name ?? "Direct message",
    campaignInstructions,
  });
  await prisma.aiRun.create({
    data: {
      userId,
      replyId: reply.id,
      type: "CLASSIFY_REPLY",
      provider: provider.name,
      model: provider.name === "demo" ? "demo" : undefined,
      input: { subject: reply.subject, body: reply.body } as unknown as Prisma.InputJsonValue,
      output: classification as unknown as Prisma.InputJsonValue,
      status: "SUCCESS",
      completedAt: new Date(),
    },
  });

  await prisma.reply.update({
    where: { id: reply.id },
    data: { status: "CLASSIFIED", intent: classification.intent, confidence: classification.confidence, processedAt: new Date() },
  });
  await prisma.lead.update({
    where: { id: reply.leadId },
    data: { aiIntent: classification.intent, aiConfidence: classification.confidence },
  });

  // 2) Generate a draft.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  const draft = await provider.generateReply({
    originalSubject: reply.message?.subject ?? "",
    originalBody: reply.message?.body ?? "",
    replySubject: reply.subject ?? "",
    replyBody: reply.body ?? "",
    leadName: reply.lead.name ?? reply.lead.firstName ?? "there",
    leadCompany: reply.lead.company,
    senderName: user?.name ?? (user?.email ? user.email.split("@")[0] : "I"),
    intent: classification.intent,
    confidence: classification.confidence,
    campaignInstructions,
    replyMode: (campaign?.replyMode as "APPROVAL" | "AUTO") ?? "APPROVAL",
  });
  await prisma.aiRun.create({
    data: {
      userId,
      replyId: reply.id,
      type: "GENERATE_REPLY",
      provider: provider.name,
      model: provider.name === "demo" ? "demo" : undefined,
      input: { intent: classification.intent } as unknown as Prisma.InputJsonValue,
      output: { draftText: draft.draftText } as unknown as Prisma.InputJsonValue,
      status: "SUCCESS",
      completedAt: new Date(),
    },
  });

  // 3) Route: escalate / auto-send / review.
  const escalation = classification.escalation?.trim() || null;
  const allowedIntents = (campaign?.autoReplyIntents as unknown as ReplyIntent[] | null) ?? DEFAULT_AUTO_REPLY_INTENTS;
  const route = decideSendRoute({
    isAutoReplyCandidate: classification.isAutoReplyCandidate,
    escalation,
    replyMode: (campaign?.replyMode as "APPROVAL" | "AUTO") ?? "APPROVAL",
    intent: classification.intent,
    allowedIntents,
    confidence: classification.confidence,
  });

  const aiReply = await prisma.aiReply.create({
    data: {
      replyId: reply.id,
      leadId: reply.leadId,
      campaignId: reply.campaignId,
      intent: classification.intent,
      confidence: classification.confidence,
      draftText: draft.draftText,
      status: route.status,
      escalation: route.escalation,
    },
  });

  await logActivity(
    userId,
    "AI_CLASSIFIED",
    `Reply from ${reply.lead.email} classified as ${classification.intent} (${Math.round(classification.confidence * 100)}%)`,
    { replyId: reply.id, campaignId: reply.campaignId, intent: classification.intent },
  );

  if (route.status === "SENT") {
    await sendAiReply(aiReply.id, userId);
  }

  return {
    replyId: reply.id,
    status: aiReply.status,
    intent: classification.intent,
  };
}

/** Send an approved (or auto-approved) AI draft into the reply's thread. */
export async function sendAiReply(
  aiReplyId: string,
  userId?: string,
): Promise<{ messageId: string; skipped?: boolean }> {
  const aiReply = await prisma.aiReply.findUnique({
    where: { id: aiReplyId },
    include: {
      reply: {
        include: {
          lead: true,
          message: true,
          campaign: { include: { mailbox: { include: { googleConnection: true } } } },
        },
      },
    },
  });
  if (!aiReply?.reply) throw new Error(`AiReply ${aiReplyId} not found`);
  if (aiReply.status === "SENT" || aiReply.status === "REJECTED") {
    return { messageId: "", skipped: true };
  }
  const ownerId = aiReply.reply.lead.userId;
  if (userId && userId !== ownerId) throw new Error("Not your reply draft");

  const campaign = aiReply.reply.campaign;
  const mailbox = campaign?.mailbox;
  if (!mailbox || mailbox.status !== "ACTIVE" || !mailbox.googleConnection) {
    throw new Error("Campaign's sending mailbox is not active");
  }
  const lead = aiReply.reply.lead;
  const user = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { name: true, email: true },
  });
  const ctx = buildRenderContext(lead, mailbox, user);
  const from = formatSender(ctx.sender);

  const threadId = aiReply.reply.threadId ?? aiReply.reply.message?.gmailThreadId ?? undefined;
  const subject = /^re:/i.test(aiReply.reply.subject ?? "")
    ? (aiReply.reply.subject ?? "")
    : `Re: ${aiReply.reply.subject ?? ""}`;

  const gmail = await getGmailClient(mailbox.googleConnection);
  const raw = buildRawMessage({
    from,
    to: lead.email,
    subject,
    body: aiReply.draftText,
  });
  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: threadId ? { raw, threadId } : { raw },
  });

  const message = await prisma.message.create({
    data: {
      campaignId: campaign?.id ?? null,
      leadId: lead.id,
      mailboxId: mailbox.id,
      direction: "SENT",
      subject,
      body: aiReply.draftText,
      status: "SENT",
      gmailMessageId: res.data.id ?? undefined,
      gmailThreadId: res.data.threadId ?? threadId ?? undefined,
      sentAt: new Date(),
    },
  });
  await prisma.messageEvent.create({
    data: {
      messageId: message.id,
      type: "SENT",
      data: { gmailMessageId: res.data.id, gmailThreadId: res.data.threadId, via: "ai-reply" },
      occurredAt: new Date(),
    },
  });
  await prisma.aiReply.update({
    where: { id: aiReply.id },
    data: { status: "SENT", sentAt: new Date(), reviewedAt: new Date() },
  });
  await prisma.reply.update({
    where: { id: aiReply.replyId! },
    data: { status: "SENT", processedAt: new Date() },
  });
  await prisma.lead.update({
    where: { id: lead.id },
    data: { lastContactedAt: new Date(), status: "REPLIED" },
  });

  await logActivity(
    ownerId,
    "AI_REPLY_SENT",
    `AI reply sent to ${lead.email} (intent: ${aiReply.intent ?? "unknown"})`,
    { aiReplyId: aiReply.id, replyId: aiReply.replyId, campaignId: campaign?.id },
  );

  return { messageId: message.id };
}

/** Human rejects a pending draft. */
export async function rejectAiReply(
  aiReplyId: string,
  userId?: string,
): Promise<{ status: string; skipped?: boolean }> {
  const aiReply = await prisma.aiReply.findUnique({
    where: { id: aiReplyId },
    include: { reply: { select: { lead: { select: { userId: true } } } } },
  });
  if (!aiReply) throw new Error(`AiReply ${aiReplyId} not found`);
  if (aiReply.status === "SENT" || aiReply.status === "REJECTED") {
    return { status: aiReply.status, skipped: true };
  }
  const ownerId = aiReply.reply?.lead.userId;
  if (userId && ownerId && userId !== ownerId) throw new Error("Not your reply draft");

  await prisma.aiReply.update({
    where: { id: aiReply.id },
    data: { status: "REJECTED", reviewedAt: new Date() },
  });
  if (aiReply.replyId) {
    await prisma.reply.update({
      where: { id: aiReply.replyId },
      data: { status: "IGNORED", processedAt: new Date() },
    });
  }
  return { status: "REJECTED" };
}

function readCampaignInstructions(settings: Prisma.JsonValue | null | undefined): string {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return "";
  const s = settings as Record<string, unknown>;
  return typeof s.aiInstructions === "string" ? s.aiInstructions : "";
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
    console.error("[ai] activity log failed:", error);
  }
}
