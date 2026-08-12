import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import {
  createCampaign,
  REPLY_MODES,
  validateCampaignRefs,
  type CampaignInput,
} from "@/lib/campaigns/campaigns";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as CampaignInput | null;
  if (!body?.name?.trim()) {
    return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
  }
  if (body.replyMode && !(REPLY_MODES as readonly string[]).includes(body.replyMode)) {
    return NextResponse.json({ error: "Invalid reply mode" }, { status: 400 });
  }
  const refError = await validateCampaignRefs(user.id, body);
  if (refError) {
    return NextResponse.json({ error: refError }, { status: 400 });
  }

  try {
    const campaign = await createCampaign(user.id, body);
    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    console.error("[campaigns] create failed:", error);
    return NextResponse.json({ error: "Could not create campaign" }, { status: 400 });
  }
}
