import Link from "next/link";
import { Megaphone, Plus } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import {
  CAMPAIGN_STATUS_LABELS,
  listCampaigns,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CampaignDeleteButton } from "@/components/campaigns/campaign-delete-button";

const STATUS_VARIANTS: Record<string, "default" | "outline" | "secondary" | "destructive"> = {
  DRAFT: "secondary",
  SCHEDULED: "default",
  RUNNING: "default",
  PAUSED: "outline",
  COMPLETED: "secondary",
  ARCHIVED: "outline",
};

export default async function CampaignsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const campaigns = await listCampaigns(user.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground text-sm">
            Multi-step outreach with pacing, replies and AI.
          </p>
        </div>
        <Button render={<Link href="/campaigns/new" />}>
          <Plus />
          New campaign
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="size-4" />
              No campaigns yet
            </CardTitle>
            <CardDescription>
              Build your first campaign — pick a sending mailbox, a lead
              spreadsheet and an initial template, then review the validation
              summary before launch.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Leads</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell>
                      <Link
                        href={`/campaigns/${campaign.id}`}
                        className="hover:underline font-medium"
                      >
                        {campaign.name}
                      </Link>
                      <div className="text-muted-foreground text-xs">
                        {campaign.description ?? ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[campaign.status] ?? "outline"}>
                        {CAMPAIGN_STATUS_LABELS[campaign.status as keyof typeof CAMPAIGN_STATUS_LABELS] ?? campaign.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{campaign._count.campaignLeads}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(campaign.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        render={<Link href={`/campaigns/${campaign.id}/edit`} />}
                      >
                        Edit
                      </Button>
                      <CampaignDeleteButton campaignId={campaign.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
