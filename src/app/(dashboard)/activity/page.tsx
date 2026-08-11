import { Activity } from "lucide-react";

import { PlaceholderPage } from "@/components/dashboard/placeholder-page";

export default function ActivityPage() {
  return (
    <PlaceholderPage
      title="Activity"
      description="A chronological feed of everything happening in your workspace."
      icon={Activity}
      phase="Phase 7"
      planned={[
        "Email sent, reply received, AI classified events",
        "Campaign started / paused / completed",
        "Sheet syncs and mailbox expirations",
        "Filter by type and date range",
        "Notifications for things that need action",
      ]}
    />
  );
}
