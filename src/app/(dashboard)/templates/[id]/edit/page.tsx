import { notFound } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { getTemplate } from "@/lib/templates/templates";
import { TemplateForm } from "@/components/templates/template-form";

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { id } = await params;

  const template = await getTemplate(user.id, id);
  if (!template) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit template</h1>
        <p className="text-muted-foreground text-sm">
          Refine {template.name} — preview updates as you type.
        </p>
      </div>
      <TemplateForm
        templateId={template.id}
        defaults={{
          name: template.name,
          subject: template.subject,
          body: template.body,
          type: template.type,
        }}
      />
    </div>
  );
}
