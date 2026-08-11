import { Megaphone } from "lucide-react";

import { PlaceholderPage } from "@/components/dashboard/placeholder-page";

export default function CampaignsPage() {
  return (
    <PlaceholderPage
      title="Campaigns"
      description="Create and run multi-step outreach campaigns."
      icon={Megaphone}
      phase="Phase 3"
      planned={[
        "Campaign builder with lead source, mailbox, sequence & template selection",
        "Campaign validation summary before launch",
        "Lifecycle: draft → scheduled → running → paused → completed",
        "Per-campaign pacing: daily send limit, working hours & timezone",
        "Campaign funnel dashboard",
      ]}
    />
  );
}
