import { BarChart3 } from "lucide-react";

import { PlaceholderPage } from "@/components/dashboard/placeholder-page";

export default function AnalyticsPage() {
  return (
    <PlaceholderPage
      title="Analytics"
      description="Performance metrics across your campaigns and sends."
      icon={BarChart3}
      phase="Phase 7"
      planned={[
        "KPIs: sent, delivered, replied, meetings, bounce rate",
        "Campaign funnel visualization",
        "Reply rate and engagement over time",
        "Working-hours and pacing insights",
        "Exportable reports",
      ]}
    />
  );
}
