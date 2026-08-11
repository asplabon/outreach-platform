import { Mailbox } from "lucide-react";

import { PlaceholderPage } from "@/components/dashboard/placeholder-page";

export default function MailboxesPage() {
  return (
    <PlaceholderPage
      title="Mailboxes"
      description="Authorize Gmail accounts to send and receive campaign emails."
      icon={Mailbox}
      phase="Phase 2"
      planned={[
        "Google OAuth mailbox authorization (Gmail + Sheets scopes)",
        "Encrypted token storage — refresh tokens never reach the browser",
        "Automatic token refresh and expiry handling",
        "Connect and manage multiple sender accounts",
        "Health status: connected, expired, needs re-auth",
      ]}
    />
  );
}
