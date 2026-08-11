import { prisma } from "@/lib/db";
import {
  mapRowToLead,
  type FieldMapping,
} from "@/lib/leads/mapping";

export interface ImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
}

/**
 * Import sheet rows into the user's leads. Deduplication is by (userId, email)
 * — a database unique constraint backs this; we upsert so a re-import updates
 * the existing lead instead of creating a duplicate.
 */
export async function importLeads(
  userId: string,
  rows: Record<string, string>[],
  mapping: FieldMapping,
  source = "google-sheets",
): Promise<ImportResult> {
  // Resolve rows → (email, fields) once, dropping rows without an email.
  const mapped = rows
    .map((row) => mapRowToLead(row, mapping))
    .filter((m): m is NonNullable<typeof m> => m !== null);

  // Which of these emails already exist (for accurate created/updated counts)?
  const existing = await prisma.lead.findMany({
    where: { userId, email: { in: mapped.map((m) => m.email) } },
    select: { email: true },
  });
  const existingEmails = new Set(existing.map((l) => l.email));

  let created = 0;
  let updated = 0;
  for (const m of mapped) {
    await prisma.lead.upsert({
      where: { userId_email: { userId, email: m.email } },
      update: {
        ...m.data,
        customFields: m.customFields,
        tags: m.tags,
        source,
      },
      create: {
        userId,
        email: m.email,
        ...m.data,
        customFields: m.customFields,
        tags: m.tags,
        source,
      },
    });
    if (existingEmails.has(m.email)) updated += 1;
    else created += 1;
  }

  return {
    total: rows.length,
    created,
    updated,
    skipped: rows.length - mapped.length,
  };
}
