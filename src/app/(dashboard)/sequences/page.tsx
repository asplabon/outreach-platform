import { Workflow } from "lucide-react";

import { PlaceholderPage } from "@/components/dashboard/placeholder-page";

export default function SequencesPage() {
  return (
    <PlaceholderPage
      title="Sequences"
      description="Reusable multi-step follow-up sequences with delays and conditions."
      icon={Workflow}
      phase="Phase 5"
      planned={[
        "Build sequences from ordered steps, each referencing a template",
        "Per-step delay (days/hours) before the next message",
        "Stop rules: on reply, on unsubscribe, on bounce",
        "Reuse sequences across many campaigns",
        "Sequence step scheduling with working-hours awareness",
      ]}
    />
  );
}
