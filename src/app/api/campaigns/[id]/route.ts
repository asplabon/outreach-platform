import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import {
  deleteCampaign,
  REPLY_MODES,
  updateCampaign,
  validateCampaignRefs,
  type CampaignInput,
} from "@/lib/campaigns/campaigns";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;

  const body = (await request.json().catch(() => null)) as CampaignInput | null;
  if (!body?.name?.trim()) {
    return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
  }
  if (body.replyMode && !(REPLY_MODES as readonly string[]).includes(body.replyMode)) {
    return NextResponse.json({ error: "Invalid reply mode" }, { status: 400 });
  }

  // Only references the client actually changed are validated, so a partial
  // update that leaves existing refs untouched still passes.
  const refError = await validateCampaignRefs(user.id, body);
  if (refError) {
    return NextResponse.json({ error: refError }, { status: 400 });
  }

  try {
    const campaign = await updateCampaign(user.id, id, body);
    return NextResponse.json(campaign);
  } catch (error) {
    if (error instanceof Error && error.message === "Campaign not found") {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    console.error("[campaigns] update failed:", error);
    return NextResponse.json({ error: "Could not update campaign" }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;

  try {
    await deleteCampaign(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Campaign not found") {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    console.error("[campaigns] delete failed:", error);
    return NextResponse.json({ error: "Could not delete campaign" }, { status: 400 });
  }
}
