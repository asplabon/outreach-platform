import { Bot } from "lucide-react";

import { PlaceholderPage } from "@/components/dashboard/placeholder-page";

export default function AiRepliesPage() {
  return (
    <PlaceholderPage
      title="AI Replies"
      description="Review and approve AI-generated reply drafts to inbound emails."
      icon={Bot}
      phase="Phase 6"
      planned={[
        "Reply inbox grouped by thread with full context",
        "AI intent classification + confidence (validated with Zod)",
        "Generated reply drafts with edit-before-send",
        "Approval mode: human reviews every reply",
        "Controlled auto-reply with strict escalation rules",
      ]}
    />
  );
}
