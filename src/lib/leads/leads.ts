import { prisma } from "@/lib/db";
import type { Lead, Prisma } from "@prisma/client";

export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "REPLIED",
  "INTERESTED",
  "MEETING",
  "NOT_INTERESTED",
  "UNSUBSCRIBED",
  "BOUNCED",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  REPLIED: "Replied",
  INTERESTED: "Interested",
  MEETING: "Meeting",
  NOT_INTERESTED: "Not interested",
  UNSUBSCRIBED: "Unsubscribed",
  BOUNCED: "Bounced",
};

export type LeadSortKey = "name" | "email" | "status" | "createdAt" | "lastContactedAt";

/** Whitelist of sortable columns → Prisma field path. Prevents injection via URL. */
const SORT_FIELDS: Record<LeadSortKey, string> = {
  name: "name",
  email: "email",
  status: "status",
  createdAt: "createdAt",
  lastContactedAt: "lastContactedAt",
};

export interface LeadListParams {
  q?: string;
  status?: string;
  tag?: string;
  sort?: LeadSortKey;
  /** asc | desc */
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface LeadListResult {
  leads: Lead[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getLeads(
  userId: string,
  params: LeadListParams = {},
): Promise<LeadListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const sort = SORT_FIELDS[params.sort ?? "createdAt"] ?? "createdAt";
  const dir = params.dir === "asc" ? "asc" : "desc";

  const where: Prisma.LeadWhereInput = { userId };
  if (params.status && LEAD_STATUSES.includes(params.status as LeadStatus)) {
    where.status = params.status;
  }
  if (params.q) {
    const q = params.q.trim();
    where.OR = [
      { email: { contains: q } },
      { firstName: { contains: q } },
      { lastName: { contains: q } },
      { name: { contains: q } },
      { company: { contains: q } },
      { jobTitle: { contains: q } },
      { location: { contains: q } },
    ];
  }

  // Tags live in a Json array, which Prisma can't filter on SQLite — fetch the
  // matching ids first, then page over them. Fine for dev-scale lead lists.
  if (params.tag) {
    const tagged = await prisma.lead.findMany({
      where,
      select: { id: true, tags: true },
    });
    const ids = tagged
      .filter((l) => (l.tags as string[]).includes(params.tag as string))
      .map((l) => l.id);
    where.id = { in: ids };
  }

  const [total, leads] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      orderBy: { [sort]: dir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    leads,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getLeadById(
  userId: string,
  id: string,
): Promise<Lead | null> {
  return prisma.lead.findFirst({ where: { id, userId } });
}

/** Distinct tags across all of a user's leads, ordered by popularity. */
export async function getLeadTags(userId: string): Promise<string[]> {
  const leads = await prisma.lead.findMany({
    where: { userId },
    select: { tags: true },
  });
  const counts = new Map<string, number>();
  for (const lead of leads) {
    for (const tag of lead.tags as string[]) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);
}

export interface LeadInput {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  company?: string | null;
  website?: string | null;
  location?: string | null;
  phone?: string | null;
  industry?: string | null;
  jobTitle?: string | null;
  status?: LeadStatus;
  tags?: string[];
  notes?: string | null;
}

/** Normalize tags passed as an array or a single comma/semicolon string. */
function parseTags(tags: string[] | string | undefined): string[] {
  if (!tags) return [];
  const list = Array.isArray(tags) ? tags : [tags];
  return list
    .flatMap((t) => t.split(/[,;]/))
    .map((t) => t.trim())
    .filter(Boolean);
}

export async function createLead(
  userId: string,
  input: LeadInput,
): Promise<Lead> {
  return prisma.lead.create({
    data: {
      userId,
      email: input.email.trim().toLowerCase(),
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      name: input.name ?? null,
      company: input.company ?? null,
      website: input.website ?? null,
      location: input.location ?? null,
      phone: input.phone ?? null,
      industry: input.industry ?? null,
      jobTitle: input.jobTitle ?? null,
      status: input.status ?? "NEW",
      tags: parseTags(input.tags),
      customFields: {},
      notes: input.notes ?? null,
      source: "manual",
    },
  });
}

export async function updateLead(
  userId: string,
  id: string,
  input: Partial<LeadInput>,
): Promise<Lead> {
  const data: Prisma.LeadUpdateInput = {};
  if (input.email) data.email = input.email.trim().toLowerCase();
  if (input.firstName !== undefined) data.firstName = input.firstName;
  if (input.lastName !== undefined) data.lastName = input.lastName;
  if (input.name !== undefined) data.name = input.name;
  if (input.company !== undefined) data.company = input.company;
  if (input.website !== undefined) data.website = input.website;
  if (input.location !== undefined) data.location = input.location;
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.industry !== undefined) data.industry = input.industry;
  if (input.jobTitle !== undefined) data.jobTitle = input.jobTitle;
  if (input.status) data.status = input.status;
  if (input.tags !== undefined) data.tags = parseTags(input.tags);
  if (input.notes !== undefined) data.notes = input.notes;

  const result = await prisma.lead.updateMany({
    where: { id, userId },
    data,
  });
  if (result.count === 0) {
    throw new Error("Lead not found");
  }
  return (await prisma.lead.findUnique({ where: { id } }))!;
}

export async function deleteLead(userId: string, id: string): Promise<void> {
  const result = await prisma.lead.deleteMany({ where: { id, userId } });
  if (result.count === 0) {
    throw new Error("Lead not found");
  }
}
