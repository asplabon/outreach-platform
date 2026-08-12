import { getCurrentUser } from "@/lib/auth/session";
import { TemplateForm } from "@/components/templates/template-form";

export default async function NewTemplatePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New template</h1>
        <p className="text-muted-foreground text-sm">
          Build a reusable email with personalized variables.
        </p>
      </div>
      <TemplateForm />
    </div>
  );
}
