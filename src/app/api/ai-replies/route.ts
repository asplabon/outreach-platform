import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * List AI-generated reply drafts for the signed-in user (newest first).
 * The review page uses this to render the queue; statuses include
 * PENDING_REVIEW / ESCALATED / SENT / REJECTED.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? undefined;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "100"), 200);

  const drafts = await prisma.aiReply.findMany({
    where: {
      lead: { userId: user.id },
      ...(status ? { status } : {}),
    },
    include: {
      lead: { select: { id: true, name: true, firstName: true, email: true, company: true } },
      reply: { select: { id: true, subject: true, body: true, receivedAt: true } },
      campaign: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ drafts });
}
