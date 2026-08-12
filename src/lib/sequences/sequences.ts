import { prisma } from "@/lib/db";
import type { Prisma, Sequence } from "@prisma/client";

/**
 * Sequences are the follow-up machinery: an ordered list of steps, each with a
 * delay (days after the previous send) and an email to send. A campaign's
 * step 0 is its initial template (Phase 4); the attached sequence supplies the
 * follow-up steps 1..N (Phase 5). Empty sequences are allowed — a campaign with
 * no sequence is single-message.
 */

export interface SequenceStepInput {
  delayDays: number;
  templateId?: string | null;
  /** Inline fallback used when no template is chosen. */
  subject?: string | null;
  body?: string | null;
  conditions?: Record<string, unknown>;
}

export interface SequenceInput {
  name: string;
  description?: string | null;
  steps: SequenceStepInput[];
}

export type SequenceWithSteps = Sequence & { steps: SequenceStepForDisplay[] };

type SequenceStepForDisplay = {
  id: string;
  order: number;
  delayDays: number;
  templateId: string | null;
  subject: string | null;
  body: string | null;
  conditions: unknown;
};

export type SequenceWithCampaignCount = Sequence & {
  steps: SequenceStepForDisplay[];
  _count: { campaigns: number };
};

export async function listSequences(
  userId: string,
): Promise<SequenceWithCampaignCount[]> {
  return prisma.sequence.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      steps: { orderBy: { order: "asc" } },
      _count: { select: { campaigns: true } },
    },
  });
}

export async function getSequence(
  userId: string,
  id: string,
): Promise<SequenceWithSteps | null> {
  return prisma.sequence.findFirst({
    where: { id, userId },
    include: { steps: { orderBy: { order: "asc" } } },
  });
}

/** Ids of the user's templates referenced by a sequence (for ownership checks). */
async function validateStepTemplates(
  userId: string,
  steps: SequenceStepInput[],
): Promise<string | null> {
  const templateIds = [
    ...new Set(steps.map((s) => s.templateId).filter(Boolean) as string[]),
  ];
  if (templateIds.length === 0) return null;
  const owned = await prisma.emailTemplate.count({
    where: { userId, id: { in: templateIds } },
  });
  return owned === templateIds.length ? null : "A step references a template you don't own";
}

function toStepData(input: SequenceStepInput, order: number) {
  return {
    order,
    delayDays: Math.max(0, Math.floor(input.delayDays || 0)),
    templateId: input.templateId ?? null,
    subject: input.subject ?? null,
    body: input.body ?? null,
    conditions: (input.conditions ?? {}) as unknown as Prisma.InputJsonValue,
  };
}

export async function createSequence(
  userId: string,
  input: SequenceInput,
): Promise<SequenceWithSteps> {
  const error = await validateStepTemplates(userId, input.steps);
  if (error) throw new Error(error);
  return prisma.sequence.create({
    data: {
      userId,
      name: input.name,
      description: input.description ?? null,
      steps: {
        create: input.steps.map((s, i) => toStepData(s, i)),
      },
    },
    include: { steps: { orderBy: { order: "asc" } } },
  });
}

export async function updateSequence(
  userId: string,
  id: string,
  input: SequenceInput,
): Promise<SequenceWithSteps> {
  const error = await validateStepTemplates(userId, input.steps);
  if (error) throw new Error(error);
  const owned = await prisma.sequence.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) throw new Error("Sequence not found");
  return prisma.sequence.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description ?? null,
      // Rebuild the steps wholesale — simplest correct model for a small list.
      steps: {
        deleteMany: {},
        create: input.steps.map((s, i) => toStepData(s, i)),
      },
    },
    include: { steps: { orderBy: { order: "asc" } } },
  });
}

export async function deleteSequence(userId: string, id: string): Promise<void> {
  const result = await prisma.sequence.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw new Error("Sequence not found");
}

/** Compact options for the campaign form's sequence selector. */
export async function getSequenceOptions(userId: string): Promise<
  { id: string; label: string }[]
> {
  const sequences = await prisma.sequence.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, _count: { select: { steps: true } } },
  });
  return sequences.map((s) => ({
    id: s.id,
    label: s._count.steps > 0 ? `${s.name} (${s._count.steps} steps)` : s.name,
  }));
}