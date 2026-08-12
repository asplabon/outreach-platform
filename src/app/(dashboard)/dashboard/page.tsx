import Link from "next/link";
import { Bot, Mail, Megaphone, Users } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

async function getOverview(userId: string) {
  const [leadCount, campaignCount, messageCount, pendingAiReplies, campaigns] =
    await Promise.all([
      prisma.lead.count({ where: { userId } }),
      prisma.campaign.count({ where: { userId } }),
      prisma.message.count({
        where: { lead: { userId }, direction: "SENT" },
      }),
      prisma.aiReply.count({
        where: { lead: { userId }, status: "PENDING_REVIEW" },
      }),
      prisma.campaign.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          status: true,
          updatedAt: true,
          _count: { select: { campaignLeads: true } },
        },
      }),
    ]);
  return { leadCount, campaignCount, messageCount, pendingAiReplies, campaigns };
}

const KPI_ICONS = {
  leads: Users,
  campaigns: Megaphone,
  sent: Mail,
  ai: Bot,
} as const;

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const stats = await getOverview(user.id);

  const kpis = [
    {
      label: "Leads",
      value: stats.leadCount,
      icon: KPI_ICONS.leads,
      href: "/leads",
      hint: "in your lead list",
    },
    {
      label: "Campaigns",
      value: stats.campaignCount,
      icon: KPI_ICONS.campaigns,
      href: "/campaigns",
      hint: "across all states",
    },
    {
      label: "Emails sent",
      value: stats.messageCount,
      icon: KPI_ICONS.sent,
      href: "/analytics",
      hint: "outbound messages",
    },
    {
      label: "AI replies",
      value: stats.pendingAiReplies,
      icon: KPI_ICONS.ai,
      href: "/ai-replies",
      hint: "pending your review",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back{user.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-muted-foreground text-sm">
          Here is what is happening across your outreach.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Link key={kpi.label} href={kpi.href} className="block">
            <Card className="transition-colors hover:bg-muted/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {kpi.label}
                </CardTitle>
                <kpi.icon className="text-muted-foreground size-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.value}</div>
                <p className="text-muted-foreground text-xs">{kpi.hint}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Campaigns</CardTitle>
              <CardDescription>Your most recently updated campaigns</CardDescription>
            </div>
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/campaigns" />}>
              View all
            </Button>
          </CardHeader>
          <CardContent>
            {stats.campaigns.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Megaphone className="text-muted-foreground size-8" />
                <p className="text-sm text-muted-foreground">
                  No campaigns yet. Create your first campaign when the
                  campaign builder ships.
                </p>
                <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/campaigns" />}>
                  Campaigns
                </Button>
              </div>
            ) : (
              <ul className="divide-y">
                {stats.campaigns.map((campaign) => (
                  <li key={campaign.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/campaigns/${campaign.id}`}
                        className="truncate text-sm font-medium hover:underline"
                      >
                        {campaign.name}
                      </Link>
                      <p className="text-muted-foreground text-xs">
                        {campaign._count.campaignLeads} leads · updated{" "}
                        {formatDate(campaign.updatedAt)}
                      </p>
                    </div>
                    <Badge variant="secondary">{campaign.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Getting started</CardTitle>
            <CardDescription>
              Milestones for the build — each lands complete with its phase.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm">
              <Milestone done label="Project scaffold, database schema, and auth" />
              <Milestone
                label="Connect your Google mailbox & lead sheet (Phase 2)"
              />
              <Milestone label="Leads, campaigns & templates (Phase 3)" />
              <Milestone label="Gmail sending engine with pacing (Phase 4)" />
              <Milestone label="Follow-up sequences & reply detection (Phase 5)" />
              <Milestone label="AI classification & reply drafts (Phase 6)" />
              <Milestone label="Analytics, activity & notifications (Phase 7)" />
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Milestone({ done = false, label }: { done?: boolean; label: string }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${
          done
            ? "bg-primary text-primary-foreground border-primary"
            : "border-muted-foreground/40"
        }`}
      >
        {done ? "✓" : ""}
      </span>
      <span className={done ? "" : "text-muted-foreground"}>{label}</span>
    </li>
  );
}
