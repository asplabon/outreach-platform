import { prisma } from "@/lib/db";
import type { Campaign, Prisma } from "@prisma/client";

export const CAMPAIGN_STATUSES = [
  "DRAFT",
  "SCHEDULED",
  "RUNNING",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED",
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  RUNNING: "Running",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

export const REPLY_MODES = ["APPROVAL", "AUTO"] as const;
export type ReplyMode = (typeof REPLY_MODES)[number];

export const AUTO_REPLY_INTENTS = [
  "PRICING_REQUEST",
  "MEETING_REQUEST",
  "PRODUCT_INFO",
  "GENERAL",
] as const;

export interface CampaignInput {
  name: string;
  description?: string | null;
  mailboxId?: string | null;
  spreadsheetId?: string | null;
  initialTemplateId?: string | null;
  dailySendLimit?: number;
  timezone?: string;
  workingHoursStart?: string;
  workingHoursEnd?: string;
  sendDelayMin?: number;
  sendDelayMax?: number;
  replyMode?: ReplyMode;
  autoReplyIntents?: string[];
  stopOnReply?: boolean;
  aiInstructions?: string;
}

export interface CampaignFormOptions {
  mailboxes: { id: string; label: string }[];
  spreadsheets: { id: string; label: string }[];
  templates: { id: string; label: string }[];
}

/** Options to populate the campaign builder selects. */
export async function getCampaignFormOptions(
  userId: string,
): Promise<CampaignFormOptions> {
  const [mailboxes, spreadsheets, templates] = await Promise.all([
    prisma.mailbox.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, emailAddress: true },
    }),
    prisma.spreadsheet.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true },
    }),
    prisma.emailTemplate.findMany({
      where: { userId, type: "INITIAL" },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true },
    }),
  ]);
  return {
    mailboxes: mailboxes.map((m) => ({ id: m.id, label: m.emailAddress })),
    spreadsheets: spreadsheets.map((s) => ({ id: s.id, label: s.title })),
    templates: templates.map((t) => ({ id: t.id, label: t.name })),
  };
}

export type CampaignWithLeadCount = Campaign & {
  _count: { campaignLeads: number };
};

export async function listCampaigns(
  userId: string,
): Promise<CampaignWithLeadCount[]> {
  return prisma.campaign.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { campaignLeads: true } },
    },
  });
}

export async function getCampaign(
  userId: string,
  id: string,
): Promise<
  | (Campaign & {
      mailbox: { id: string; emailAddress: string } | null;
      spreadsheet: { id: string; title: string } | null;
      initialTemplate: { id: string; name: string } | null;
    })
  | null
> {
  return prisma.campaign.findFirst({
    where: { id, userId },
    include: {
      mailbox: { select: { id: true, emailAddress: true } },
      spreadsheet: { select: { id: true, title: true } },
      initialTemplate: { select: { id: true, name: true } },
    },
  });
}

/** Validate referenced resources (mailbox/spreadsheet/template) belong to user.
 * Returns an error message or null when everything is fine. */
export async function validateCampaignRefs(
  userId: string,
  input: Pick<CampaignInput, "mailboxId" | "spreadsheetId" | "initialTemplateId">,
): Promise<string | null> {
  if (input.mailboxId) {
    const mailbox = await prisma.mailbox.findFirst({
      where: { id: input.mailboxId, userId },
      select: { id: true },
    });
    if (!mailbox) return "mailboxId is not yours or does not exist";
  }
  if (input.spreadsheetId) {
    const spreadsheet = await prisma.spreadsheet.findFirst({
      where: { id: input.spreadsheetId, userId },
      select: { id: true },
    });
    if (!spreadsheet) return "spreadsheetId is not yours or does not exist";
  }
  if (input.initialTemplateId) {
    const template = await prisma.emailTemplate.findFirst({
      where: { id: input.initialTemplateId, userId },
      select: { id: true },
    });
    if (!template) return "initialTemplateId is not yours or does not exist";
  }
  return null;
}

export async function createCampaign(
  userId: string,
  input: CampaignInput,
): Promise<Campaign> {
  return prisma.campaign.create({
    data: {
      userId,
      name: input.name,
      description: input.description ?? null,
      mailboxId: input.mailboxId ?? null,
      spreadsheetId: input.spreadsheetId ?? null,
      initialTemplateId: input.initialTemplateId ?? null,
      dailySendLimit: input.dailySendLimit ?? 50,
      timezone: input.timezone ?? "UTC",
      workingHoursStart: input.workingHoursStart ?? "09:00",
      workingHoursEnd: input.workingHoursEnd ?? "18:00",
      sendDelayMin: input.sendDelayMin ?? 60,
      sendDelayMax: input.sendDelayMax ?? 120,
      replyMode: input.replyMode ?? "APPROVAL",
      autoReplyIntents: input.autoReplyIntents ?? [],
      settings: {
        stopOnReply: input.stopOnReply ?? true,
        aiInstructions: input.aiInstructions ?? "",
      },
    },
  });
}

export async function updateCampaign(
  userId: string,
  id: string,
  input: CampaignInput,
): Promise<Campaign> {
  const data: Prisma.CampaignUncheckedUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.mailboxId !== undefined) data.mailboxId = input.mailboxId;
  if (input.spreadsheetId !== undefined) data.spreadsheetId = input.spreadsheetId;
  if (input.initialTemplateId !== undefined)
    data.initialTemplateId = input.initialTemplateId;
  if (input.dailySendLimit !== undefined) data.dailySendLimit = input.dailySendLimit;
  if (input.timezone !== undefined) data.timezone = input.timezone;
  if (input.workingHoursStart !== undefined)
    data.workingHoursStart = input.workingHoursStart;
  if (input.workingHoursEnd !== undefined)
    data.workingHoursEnd = input.workingHoursEnd;
  if (input.sendDelayMin !== undefined) data.sendDelayMin = input.sendDelayMin;
  if (input.sendDelayMax !== undefined) data.sendDelayMax = input.sendDelayMax;
  if (input.replyMode !== undefined) data.replyMode = input.replyMode;
  if (input.autoReplyIntents !== undefined) data.autoReplyIntents = input.autoReplyIntents;
  if (input.stopOnReply !== undefined || input.aiInstructions !== undefined) {
    const existing = (await prisma.campaign.findFirst({ where: { id, userId }, select: { settings: true } }))?.settings ?? {};
    data.settings = {
      ...(existing as object),
      ...(input.stopOnReply !== undefined ? { stopOnReply: input.stopOnReply } : {}),
      ...(input.aiInstructions !== undefined ? { aiInstructions: input.aiInstructions } : {}),
    };
  }

  const result = await prisma.campaign.updateMany({
    where: { id, userId },
    data,
  });
  if (result.count === 0) {
    throw new Error("Campaign not found");
  }
  return (await prisma.campaign.findUnique({ where: { id } }))!;
}

export async function deleteCampaign(userId: string, id: string): Promise<void> {
  const result = await prisma.campaign.deleteMany({ where: { id, userId } });
  if (result.count === 0) {
    throw new Error("Campaign not found");
  }
}

/** All leads the campaign's spreadsheet has imported (its potential audience). */
async function getCampaignAudience(campaign: Campaign): Promise<number> {
  if (!campaign.spreadsheetId) return 0;
  // Leads imported from this spreadsheet are the campaign's source audience.
  return prisma.lead.count({
    where: { userId: campaign.userId, source: "google-sheets" },
  });
}

export interface CampaignValidationItem {
  label: string;
  ok: boolean;
  detail: string;
}

export interface CampaignValidation {
  items: CampaignValidationItem[];
  ready: boolean;
  /** Estimated audience size (leads available to message). */
  audience: number;
  missing: string[];
}

/**
 * Validate a campaign is ready to launch. Only checks what Phase 3 can know —
 * Phase 4 wiring (working-hours / pacing internals) is validated at launch.
 */
export async function getCampaignValidation(
  campaign: Campaign,
): Promise<CampaignValidation> {
  const items: CampaignValidationItem[] = [];

  items.push({
    label: "Campaign name",
    ok: Boolean(campaign.name.trim()),
    detail: campaign.name.trim() || "Give the campaign a name.",
  });

  const mailbox = campaign.mailboxId
    ? await prisma.mailbox.findUnique({
        where: { id: campaign.mailboxId },
        select: { id: true, emailAddress: true, status: true, userId: true },
      })
    : null;
  const mailboxOk =
    mailbox !== null &&
    mailbox.status === "ACTIVE" &&
    mailbox.userId === campaign.userId;
  items.push({
    label: "Sending mailbox",
    ok: mailboxOk,
    detail: mailboxOk
      ? mailbox!.emailAddress
      : "Pick an active mailbox to send from.",
  });

  const spreadsheet = campaign.spreadsheetId
    ? await prisma.spreadsheet.findUnique({
        where: { id: campaign.spreadsheetId },
        select: { id: true, title: true, userId: true },
      })
    : null;
  const spreadsheetOk = spreadsheet !== null && spreadsheet.userId === campaign.userId;
  items.push({
    label: "Lead source (spreadsheet)",
    ok: spreadsheetOk,
    detail: spreadsheetOk
      ? spreadsheet!.title
      : "Pick a spreadsheet as the lead source.",
  });

  const template = campaign.initialTemplateId
    ? await prisma.emailTemplate.findUnique({
        where: { id: campaign.initialTemplateId },
        select: { id: true, name: true, userId: true },
      })
    : null;
  const templateOk = template !== null && template.userId === campaign.userId;
  items.push({
    label: "Initial template",
    ok: templateOk,
    detail: templateOk
      ? template!.name
      : "Pick an initial email template.",
  });

  const audience = await getCampaignAudience(campaign);
  items.push({
    label: "Leads available",
    ok: audience > 0,
    detail:
      audience > 0
        ? `${audience} leads imported`
        : "Import leads from the spreadsheet first.",
  });

  const hoursOk =
    /^\d{2}:\d{2}$/.test(campaign.workingHoursStart) &&
    /^\d{2}:\d{2}$/.test(campaign.workingHoursEnd) &&
    campaign.workingHoursStart < campaign.workingHoursEnd;
  items.push({
    label: "Working hours",
    ok: hoursOk,
    detail: hoursOk
      ? `${campaign.workingHoursStart}–${campaign.workingHoursEnd} (${campaign.timezone})`
      : "Working hours must be a valid start < end range.",
  });

  const delayOk =
    campaign.sendDelayMin >= 0 &&
    campaign.sendDelayMax >= campaign.sendDelayMin;
  items.push({
    label: "Send delay",
    ok: delayOk,
    detail: delayOk
      ? `${campaign.sendDelayMin}–${campaign.sendDelayMax}s between sends`
      : "Send delay max must be ≥ min.",
  });

  const missing = items.filter((i) => !i.ok).map((i) => i.label);
  return {
    items,
    ready: missing.length === 0,
    audience,
    missing,
  };
}
