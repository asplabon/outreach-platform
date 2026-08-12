import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { deleteSequence, updateSequence } from "@/lib/sequences/sequences";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;

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
    const sequence = await updateSequence(user.id, id, {
      name: body.name,
      description: body.description ?? null,
      steps,
    });
    return NextResponse.json(sequence);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update sequence";
    const status = message === "Sequence not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;

  try {
    await deleteSequence(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete sequence";
    const status = message === "Sequence not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}