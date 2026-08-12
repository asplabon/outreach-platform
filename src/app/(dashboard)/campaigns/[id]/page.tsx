import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Megaphone, TriangleAlert, XCircle } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import {
  CAMPAIGN_STATUS_LABELS,
  getCampaign,
  getCampaignValidation,
} from "@/lib/campaigns/campaigns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CampaignDeleteButton } from "@/components/campaigns/campaign-delete-button";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { id } = await params;

  const campaign = await getCampaign(user.id, id);
  if (!campaign) notFound();

  const [validation, sentCount, leadCount] = await Promise.all([
    getCampaignValidation(campaign),
    prisma.message.count({
      where: { campaignId: id, direction: "SENT" },
    }),
    prisma.campaignLead.count({ where: { campaignId: id } }),
  ]);

  const stats = [
    { label: "Leads", value: leadCount },
    { label: "Messages sent", value: sentCount },
    { label: "Audience", value: validation.audience },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{campaign.name}</h1>
          <p className="text-muted-foreground text-sm">
            {CAMPAIGN_STATUS_LABELS[campaign.status as keyof typeof CAMPAIGN_STATUS_LABELS] ?? campaign.status}
            {campaign.description ? ` · ${campaign.description}` : ""}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {campaign.mailbox ? (
              <Badge variant="secondary">{campaign.mailbox.emailAddress}</Badge>
            ) : null}
            {campaign.spreadsheet ? (
              <Badge variant="secondary">{campaign.spreadsheet.title}</Badge>
            ) : null}
            {campaign.initialTemplate ? (
              <Badge variant="secondary">{campaign.initialTemplate.name}</Badge>
            ) : null}
          </div>
        </div>
        <div className="flex gap-2">
          <CampaignDeleteButton campaignId={campaign.id} />
          <Button variant="outline" render={<Link href={`/campaigns/${campaign.id}/edit`} />}>
            Edit
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardDescription>{stat.label}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card
        className={
          validation.ready
            ? "border-emerald-600/40"
            : "border-amber-500/40"
        }
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {validation.ready ? (
              <CheckCircle2 className="text-emerald-600 size-5" />
            ) : (
              <TriangleAlert className="text-amber-500 size-5" />
            )}
            {validation.ready ? "Ready to launch" : "Missing before launch"}
          </CardTitle>
          <CardDescription>
            {validation.ready
              ? "Everything this campaign needs is in place. (Launching lands with Phase 4.)"
              : "Resolve the items below to make this campaign launchable."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {validation.items.map((item) => (
              <li
                key={item.label}
                className="flex items-start justify-between gap-3 rounded-md border px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  {item.ok ? (
                    <CheckCircle2 className="text-emerald-600 size-4 shrink-0" />
                  ) : (
                    <XCircle className="text-muted-foreground size-4 shrink-0" />
                  )}
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                <span className="text-muted-foreground text-right text-sm">
                  {item.detail}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="size-4" />
            Status history
          </CardTitle>
          <CardDescription>Campaign lifecycle and milestones.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <p className="text-muted-foreground">
            Created {formatDate(campaign.createdAt)}
            {campaign.startedAt ? ` · Started ${formatDate(campaign.startedAt)}` : ""}
            {campaign.completedAt ? ` · Completed ${formatDate(campaign.completedAt)}` : ""}
            {campaign.scheduledStartAt
              ? ` · Scheduled for ${formatDate(campaign.scheduledStartAt)}`
              : ""}
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}