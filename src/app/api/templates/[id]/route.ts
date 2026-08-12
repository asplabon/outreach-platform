import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import {
  deleteTemplate,
  TEMPLATE_TYPES,
  updateTemplate,
  type TemplateInput,
} from "@/lib/templates/templates";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;

  const body = (await request.json().catch(() => null)) as Partial<TemplateInput> | null;
  if (!body?.name?.trim() || !body?.body?.trim()) {
    return NextResponse.json(
      { error: "Template name and body are required" },
      { status: 400 },
    );
  }
  if (!(TEMPLATE_TYPES as readonly string[]).includes(body.type ?? "")) {
    return NextResponse.json({ error: "Invalid template type" }, { status: 400 });
  }

  const input: TemplateInput = {
    name: body.name.trim(),
    subject: body.subject?.trim() ?? "",
    body: body.body.trim(),
    type: body.type!,
  };

  try {
    const template = await updateTemplate(user.id, id, input);
    return NextResponse.json(template);
  } catch (error) {
    if (error instanceof Error && error.message === "Template not found") {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    console.error("[templates] update failed:", error);
    return NextResponse.json({ error: "Could not update template" }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;

  try {
    await deleteTemplate(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Template not found") {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    console.error("[templates] delete failed:", error);
    return NextResponse.json({ error: "Could not delete template" }, { status: 400 });
  }
}
