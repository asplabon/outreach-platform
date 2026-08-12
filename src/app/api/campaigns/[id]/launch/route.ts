import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { launchCampaign } from "@/lib/campaigns/launch";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;

  try {
    const result = await launchCampaign(user.id, id);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not launch campaign";
    const status = message === "Campaign not found" ? 404 : 409;
    return NextResponse.json({ error: message }, { status });
  }
}