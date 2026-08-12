import { getCurrentUser } from "@/lib/auth/session";
import { getCampaignFormOptions } from "@/lib/campaigns/campaigns";
import { CampaignForm } from "@/components/campaigns/campaign-form";

export default async function NewCampaignPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const options = await getCampaignFormOptions(user.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New campaign</h1>
        <p className="text-muted-foreground text-sm">
          Wire up a sender, lead source and first email — you&apos;ll review a
          validation summary before launching.
        </p>
      </div>
      <CampaignForm {...options} />
    </div>
  );
}
