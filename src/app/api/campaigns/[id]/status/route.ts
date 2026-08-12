import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { setCampaignStatus } from "@/lib/campaigns/launch";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;

  const body = (await request.json().catch(() => null)) as { status?: string } | null;
  const status = body?.status;
  if (status !== "RUNNING" && status !== "PAUSED") {
    return NextResponse.json(
      { error: "status must be RUNNING or PAUSED" },
      { status: 400 },
    );
  }

  try {
    const result = await setCampaignStatus(user.id, id, status);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update status";
    const statusCode = message === "Campaign not found" ? 404 : 409;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}