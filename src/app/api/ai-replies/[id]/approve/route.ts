import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { sendAiReply } from "@/lib/ai/replies";

export const dynamic = "force-dynamic";

/** Approve a pending AI draft and send it to the lead, in-thread. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const result = await sendAiReply(id, user.id);
    if (result.skipped) {
      return NextResponse.json({ error: "Draft already sent or rejected" }, { status: 409 });
    }
    return NextResponse.json({ ok: true, messageId: result.messageId });
  } catch (error) {
    console.error("[ai-replies/approve] failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not send draft" },
      { status: 400 },
    );
  }
}
