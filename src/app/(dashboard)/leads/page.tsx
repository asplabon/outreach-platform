import { Users } from "lucide-react";

import { PlaceholderPage } from "@/components/dashboard/placeholder-page";

export default function LeadsPage() {
  return (
    <PlaceholderPage
      title="Leads"
      description="Your lead database, imported from Google Sheets or added manually."
      icon={Users}
      phase="Phase 3"
      planned={[
        "Search, filter, sort & paginate across all lead fields",
        "Tags and custom fields mapped from your spreadsheet columns",
        "Lead detail view with full outreach history",
        "Bulk actions: assign to campaign, suppress, export",
        "Status tracking: new → contacted → replied → meeting",
      ]}
    />
  );
}
