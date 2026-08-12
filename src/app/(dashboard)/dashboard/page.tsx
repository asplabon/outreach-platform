import Link from "next/link";
import { Activity, Bot, Mail, Megaphone, Users } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  getDashboardStats,
  getRecentActivity,
  getSendTrend,
} from "@/lib/analytics/analytics";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatRelative } from "@/lib/format";
import { SendTrendChart } from "@/components/analytics/send-trend-chart";

const KPI_ICONS = {
  leads: Users,
  campaigns: Megaphone,
  sent: Mail,
  ai: Bot,
} as const;

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [stats, trend, recent, campaigns] = await Promise.all([
    getDashboardStats(user.id),
    getSendTrend(user.id, 14),
    getRecentActivity(user.id, 6),
    prisma.campaign.findMany({
      where: { userId: user.id },
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
      hint: `${stats.activeCampaigns} active`,
    },
    {
      label: "Emails sent",
      value: stats.sentCount,
      icon: KPI_ICONS.sent,
      href: "/analytics",
      hint: `${stats.repliedLeads} replies`,
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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Send volume</CardTitle>
            <CardDescription>
              Outbound sends vs replies, last 14 days.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SendTrendChart data={trend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4" />
              Recent activity
            </CardTitle>
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/activity" />}>
              View all
            </Button>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-muted-foreground text-sm py-6 text-center">
                Activity will appear as you send campaigns.
              </p>
            ) : (
              <ul className="space-y-3">
                {recent.map((item) => (
                  <li key={item.id} className="text-sm">
                    <p className="line-clamp-2">{item.message}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatRelative(item.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Campaigns</CardTitle>
            <CardDescription>Your most recently updated campaigns</CardDescription>
          </div>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/campaigns" />}>
            View all
          </Button>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Megaphone className="text-muted-foreground size-8" />
              <p className="text-sm text-muted-foreground">
                No campaigns yet. Create your first campaign from the campaigns
                page.
              </p>
              <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/campaigns" />}>
                Campaigns
              </Button>
            </div>
          ) : (
            <ul className="divide-y">
              {campaigns.map((campaign) => (
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
    </div>
  );
}
