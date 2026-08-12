import { getCurrentUser } from "@/lib/auth/session";
import { listTemplates } from "@/lib/templates/templates";
import { SequenceForm } from "@/components/sequences/sequence-form";

export default async function NewSequencePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const templates = (await listTemplates(user.id)).map((t) => ({
    id: t.id,
    label: t.name,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New sequence</h1>
        <p className="text-muted-foreground text-sm">
          Define the follow-up cadence. Campaigns attach to sequences at build
          time; a campaign without a sequence is single-message.
        </p>
      </div>
      <SequenceForm templates={templates} />
    </div>
  );
}