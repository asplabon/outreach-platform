import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { createLead, LEAD_STATUSES, type LeadInput } from "@/lib/leads/leads";

export const dynamic = "force-dynamic";

/** Create a lead manually. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Partial<LeadInput> | null;
  const email = body?.email?.trim().toLowerCase() ?? "";
  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "A valid email is required" },
      { status: 400 },
    );
  }
  if (body?.status && !(LEAD_STATUSES as readonly string[]).includes(body.status)) {
    return NextResponse.json({ error: "Invalid lead status" }, { status: 400 });
  }

  try {
    const lead = await createLead(user.id, {
      email,
      firstName: body?.firstName,
      lastName: body?.lastName,
      name: body?.name,
      company: body?.company,
      website: body?.website,
      location: body?.location,
      phone: body?.phone,
      industry: body?.industry,
      jobTitle: body?.jobTitle,
      status: body?.status,
      tags: body?.tags,
      notes: body?.notes,
    });
    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    // Prisma P2002 = unique constraint (userId+email) — lead already exists.
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
    console.error("[leads] create failed:", error);
    return NextResponse.json({ error: "Could not create lead" }, { status: 400 });
  }
}
