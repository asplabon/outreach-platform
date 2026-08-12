import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import {
  deleteLead,
  LEAD_STATUSES,
  updateLead,
  type LeadInput,
} from "@/lib/leads/leads";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Update a lead's editable fields (notes, tags, status, profile). */
export async function PATCH(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;

  const body = (await request.json().catch(() => null)) as Partial<LeadInput> | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (body.email !== undefined && !body.email.includes("@")) {
    return NextResponse.json(
      { error: "A valid email is required" },
      { status: 400 },
    );
  }
  if (body.status && !(LEAD_STATUSES as readonly string[]).includes(body.status)) {
    return NextResponse.json({ error: "Invalid lead status" }, { status: 400 });
  }

  try {
    const lead = await updateLead(user.id, id, body);
    return NextResponse.json(lead);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A lead with this email already exists" },
        { status: 409 },
      );
    }
    if (error instanceof Error && error.message === "Lead not found") {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    console.error("[leads] update failed:", error);
    return NextResponse.json({ error: "Could not update lead" }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;

  try {
    await deleteLead(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Lead not found") {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    console.error("[leads] delete failed:", error);
    return NextResponse.json({ error: "Could not delete lead" }, { status: 400 });
  }
}
