import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { getCampaign, getCampaignValidation } from "@/lib/campaigns/campaigns";
import { enqueue, QUEUE_NAMES } from "@/lib/queue";
import {
  computeSendTimes,
  delayUntil,
  startOfDayInTimezone,
  type SendSettings,
} from "@/lib/email/schedule";
import type { SendInitialJob } from "@/lib/email/send";

export interface LaunchResult {
  scheduled: number;
  linked: number;
  campaignId: string;
}

export interface StatusResult {
  status: string;
}

/** Leads that form a campaign's audience: active leads imported from Sheets. */
async function audienceLeads(userId: string): Promise<{ id: string }[]> {
  return prisma.lead.findMany({
    where: { userId, source: "google-sheets", suppressionStatus: "ACTIVE" },
    select: { id: true },
  });
}

/** Messages sent today by this mailbox (in the campaign's timezone). */
async function countSendsToday(mailboxId: string, timezone: string): Promise<number> {
  const today = startOfDayInTimezone(new Date(), timezone);
  return prisma.message.count({
    where: { mailboxId, direction: "SENT", sentAt: { gte: today } },
  });
}

/**
 * Launch a campaign:
 * 1. Re-validates readiness (mailbox/spreadsheet/template + param sanity).
 * 2. Links the campaign's lead audience into `CampaignLead` rows (idempotent —
 *    existing rows are left alone; suppressed leads are never added).
 * 3. Computes paced send times for every pending lead.
 * 4. Enqueues a `send-initial` job per lead with a deterministic job id and
 *    the computed delay; the worker's idempotency key prevents double sends.
 * 5. Flips the campaign to RUNNING.
 */
export async function launchCampaign(
  userId: string,
  campaignId: string,
): Promise<LaunchResult> {
  const campaign = await getCampaign(userId, campaignId);
  if (!campaign) throw new Error("Campaign not found");

  const validation = await getCampaignValidation(campaign);
  if (!validation.ready) {
    throw new Error(
      `Campaign not ready to launch: ${validation.missing.join(", ")}`,
    );
  }
  if (!campaign.mailboxId) {
    throw new Error("Campaign has no sending mailbox");
  }
  const mailbox = await prisma.mailbox.findUnique({
    where: { id: campaign.mailboxId },
    include: { googleConnection: true },
  });
  if (!mailbox || mailbox.status !== "ACTIVE" || !mailbox.googleConnection) {
    throw new Error("Campaign's sending mailbox is not active");
  }

  // Link audience (idempotent, skips suppressed leads).
  const audience = await audienceLeads(userId);
  const existingRows = await prisma.campaignLead.findMany({
    where: { campaignId },
    select: { leadId: true },
  });
  const existingIds = new Set(existingRows.map((r) => r.leadId));
  const toLink = audience.filter((l) => !existingIds.has(l.id));

  if (toLink.length > 0) {
    await prisma.campaignLead.createMany({
      data: toLink.map((l) => ({
        campaignId,
        leadId: l.id,
        status: "PENDING",
      })),
    });
  }

  // Schedule sends for every pending lead.
  const pending = await prisma.campaignLead.findMany({
    where: { campaignId, status: "PENDING" },
    select: { id: true },
  });
  const settings: SendSettings = {
    timezone: campaign.timezone,
    workingHoursStart: campaign.workingHoursStart,
    workingHoursEnd: campaign.workingHoursEnd,
    sendDelayMin: campaign.sendDelayMin,
    sendDelayMax: campaign.sendDelayMax,
    dailySendLimit: campaign.dailySendLimit,
  };
  const sentToday = await countSendsToday(mailbox.id, settings.timezone);
  const times = computeSendTimes({
    count: pending.length,
    settings,
    sentToday,
  });

  const now = new Date();
  for (let i = 0; i < pending.length; i += 1) {
    await enqueue<SendInitialJob>(
      QUEUE_NAMES.email,
      "send-initial",
      { campaignLeadId: pending[i].id },
      {
        jobId: `${pending[i].id}:INITIAL`,
        delayMs: delayUntil(times[i], now),
      },
    );
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: "RUNNING",
      startedAt: campaign.startedAt ?? new Date(),
      updatedAt: new Date(),
    },
  });

  await logActivity(
    userId,
    "CAMPAIGN_STARTED",
    `Launched "${campaign.name}" (${pending.length} emails scheduled)`,
    { campaignId, linked: toLink.length, scheduled: pending.length },
  );

  return { campaignId, linked: toLink.length, scheduled: pending.length };
}

const PAUSABLE = new Set(["RUNNING"]);
const RESUMABLE = new Set(["DRAFT", "PAUSED"]);

/**
 * Flip a campaign between RUNNING and PAUSED. Pausing stops the worker from
 * dispatching further already-scheduled jobs (the send job re-checks that the
 * campaign is RUNNING before touching Gmail); resume re-flips the flag.
 */
export async function setCampaignStatus(
  userId: string,
  campaignId: string,
  status: "RUNNING" | "PAUSED",
): Promise<StatusResult> {
  const campaign = await getCampaign(userId, campaignId);
  if (!campaign) throw new Error("Campaign not found");

  if (status === "PAUSED" && !PAUSABLE.has(campaign.status)) {
    throw new Error(`Cannot pause a ${campaign.status} campaign`);
  }
  if (status === "RUNNING" && !RESUMABLE.has(campaign.status)) {
    throw new Error(`Cannot resume a ${campaign.status} campaign`);
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status, updatedAt: new Date() },
  });
  await logActivity(
    userId,
    status === "PAUSED" ? "CAMPAIGN_PAUSED" : "CAMPAIGN_STARTED",
    `${status === "PAUSED" ? "Paused" : "Resumed"} "${campaign.name}"`,
    { campaignId },
  );
  return { status };
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
    console.error("[campaigns] activity log failed:", error);
  }
}