import { FileText } from "lucide-react";

import { PlaceholderPage } from "@/components/dashboard/placeholder-page";

export default function TemplatesPage() {
  return (
    <PlaceholderPage
      title="Templates"
      description="Email templates with {{variables}} for personalization."
      icon={FileText}
      phase="Phase 3"
      planned={[
        "Template editor with live variable preview",
        "{{first_name}}, {{company}} and custom field variables",
        "Validation: unknown variables, broken placeholders, empty content",
        "Categorize templates (initial, follow-up, reply)",
        "Reuse across sequences and campaigns",
      ]}
    />
  );
}
