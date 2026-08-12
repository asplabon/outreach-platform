import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { createSequence, listSequences } from "@/lib/sequences/sequences";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sequences = await listSequences(user.id);
  return NextResponse.json(sequences);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    name?: string;
    description?: string | null;
    steps?: unknown;
  } | null;
  if (!body?.name?.trim()) {
    return NextResponse.json({ error: "Sequence name is required" }, { status: 400 });
  }
  const steps = Array.isArray(body.steps) ? body.steps : [];

  try {
    const sequence = await createSequence(user.id, {
      name: body.name,
      description: body.description ?? null,
      steps,
    });
    return NextResponse.json(sequence, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create sequence";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}