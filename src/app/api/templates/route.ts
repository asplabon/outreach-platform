import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import {
  createTemplate,
  TEMPLATE_TYPES,
  type TemplateInput,
} from "@/lib/templates/templates";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Partial<TemplateInput> | null;
  if (!body?.name?.trim() || !body?.body?.trim()) {
    return NextResponse.json(
      { error: "Template name and body are required" },
      { status: 400 },
    );
  }
  if (!(TEMPLATE_TYPES as readonly string[]).includes(body.type ?? "")) {
    return NextResponse.json(
      { error: "Invalid template type" },
      { status: 400 },
    );
  }

  const input: TemplateInput = {
    name: body.name.trim(),
    subject: body.subject?.trim() ?? "",
    body: body.body.trim(),
    type: body.type!,
  };

  try {
    const template = await createTemplate(user.id, input);
    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("[templates] create failed:", error);
    return NextResponse.json({ error: "Could not create template" }, { status: 400 });
  }
}
