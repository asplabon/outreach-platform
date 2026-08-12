import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { rejectAiReply } from "@/lib/ai/replies";

export const dynamic = "force-dynamic";

/** Reject a pending AI draft — no email is sent. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const result = await rejectAiReply(id, user.id);
    if (result.skipped) {
      return NextResponse.json({ error: "Draft already sent or rejected" }, { status: 409 });
    }
    return NextResponse.json({ ok: true, status: result.status });
  } catch (error) {
    console.error("[ai-replies/reject] failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not reject draft" },
      { status: 400 },
    );
  }
}
