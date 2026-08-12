import { notFound } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import {
  getCampaign,
  getCampaignFormOptions,
} from "@/lib/campaigns/campaigns";
import { CampaignForm } from "@/components/campaigns/campaign-form";

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { id } = await params;

  const [campaign, options] = await Promise.all([
    getCampaign(user.id, id),
    getCampaignFormOptions(user.id),
  ]);
  if (!campaign) notFound();

  const settings = campaign.settings as { stopOnReply?: boolean; aiInstructions?: string };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit campaign</h1>
        <p className="text-muted-foreground text-sm">
          Update {campaign.name} — drafts stay draft until you launch.
        </p>
      </div>
      <CampaignForm
        campaignId={campaign.id}
        defaults={{
          name: campaign.name,
          description: campaign.description,
          mailboxId: campaign.mailboxId,
          spreadsheetId: campaign.spreadsheetId,
          initialTemplateId: campaign.initialTemplateId,
          sequenceId: campaign.sequenceId,
          dailySendLimit: campaign.dailySendLimit,
          timezone: campaign.timezone,
          workingHoursStart: campaign.workingHoursStart,
          workingHoursEnd: campaign.workingHoursEnd,
          sendDelayMin: campaign.sendDelayMin,
          sendDelayMax: campaign.sendDelayMax,
          replyMode: campaign.replyMode,
          autoReplyIntents: campaign.autoReplyIntents as string[],
          stopOnReply: settings.stopOnReply ?? true,
          aiInstructions: settings.aiInstructions ?? "",
        }}
        {...options}
      />
    </div>
  );
}
