import { prisma } from "@/lib/db";
import type { EmailTemplate } from "@prisma/client";

export const TEMPLATE_TYPES = ["INITIAL", "FOLLOW_UP", "MANUAL"] as const;
export type TemplateType = (typeof TEMPLATE_TYPES)[number];

export interface TemplateInput {
  name: string;
  subject: string;
  body: string;
  type: TemplateType;
}

export async function listTemplates(userId: string): Promise<EmailTemplate[]> {
  return prisma.emailTemplate.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getTemplate(
  userId: string,
  id: string,
): Promise<EmailTemplate | null> {
  return prisma.emailTemplate.findFirst({ where: { id, userId } });
}

export async function createTemplate(
  userId: string,
  input: TemplateInput,
): Promise<EmailTemplate> {
  return prisma.emailTemplate.create({
    data: { userId, ...input },
  });
}

export async function updateTemplate(
  userId: string,
  id: string,
  input: TemplateInput,
): Promise<EmailTemplate> {
  const result = await prisma.emailTemplate.updateMany({
    where: { id, userId },
    data: { ...input, updatedAt: new Date() },
  });
  if (result.count === 0) {
    throw new Error("Template not found");
  }
  const updated = await prisma.emailTemplate.findUnique({ where: { id } });
  return updated!;
}

export async function deleteTemplate(userId: string, id: string): Promise<void> {
  const result = await prisma.emailTemplate.deleteMany({
    where: { id, userId },
  });
  if (result.count === 0) {
    throw new Error("Template not found");
  }
}
