import { notFound } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { getSequence } from "@/lib/sequences/sequences";
import { listTemplates } from "@/lib/templates/templates";
import { SequenceForm } from "@/components/sequences/sequence-form";

export default async function EditSequencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { id } = await params;

  const [sequence, templates] = await Promise.all([
    getSequence(user.id, id),
    listTemplates(user.id),
  ]);
  if (!sequence) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit sequence</h1>
        <p className="text-muted-foreground text-sm">
          Update {sequence.name} — changes apply to new sends, not ones already
          scheduled.
        </p>
      </div>
      <SequenceForm
        sequenceId={sequence.id}
        templates={templates.map((t) => ({ id: t.id, label: t.name }))}
        defaults={{
          name: sequence.name,
          description: sequence.description,
          steps: sequence.steps.map((s) => ({
            delayDays: s.delayDays,
            templateId: s.templateId,
            subject: s.subject ?? "",
            body: s.body ?? "",
          })),
        }}
      />
    </div>
  );
}