import { BarChart3, Bot, Mail, MailX, Megaphone, Reply } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import {
  getCampaignFunnel,
  getDashboardStats,
  getSendTrend,
  percent,
  toCsv,
} from "@/lib/analytics/analytics";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { KpiCard } from "@/components/analytics/kpi-card";
import { SendTrendChart } from "@/components/analytics/send-trend-chart";
import { CampaignFunnel } from "@/components/analytics/campaign-funnel";
import { CsvExportButton } from "@/components/analytics/csv-export-button";

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [stats, trend, funnel] = await Promise.all([
    getDashboardStats(user.id),
    getSendTrend(user.id, 14),
    getCampaignFunnel(user.id),
  ]);

  const funnelCsv = toCsv(
    funnel.map((row) => ({
      campaign: row.name,
      total: row.total,
      sent: row.sent,
      replied: row.replied,
      interested: row.interested,
      send_rate: percent(row.sent / (row.total || 1), 1),
      reply_rate: percent(row.replied / (row.sent || 1), 1),
    })),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground text-sm">
            Performance across your campaigns — sends, replies, and engagement.
          </p>
        </div>
        <CsvExportButton filename="campaign-funnel.csv" csv={funnelCsv} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label="Emails sent"
          value={stats.sentCount}
          hint="sent outbound"
          icon={Mail}
        />
        <KpiCard
          label="Reply rate"
          value={percent(stats.replyRate)}
          hint={`${stats.repliedLeads} leads replied`}
          icon={Reply}
          accent="text-chart-2"
        />
        <KpiCard
          label="Bounce rate"
          value={percent(stats.bounceRate)}
          hint={`${stats.bouncedCount} bounced`}
          icon={MailX}
          accent={stats.bounceRate > 0.1 ? "text-destructive" : ""}
        />
        <KpiCard
          label="AI pending"
          value={stats.pendingAiReplies}
          hint="awaiting review"
          icon={Bot}
          accent="text-chart-3"
        />
        <KpiCard
          label="Active campaigns"
          value={stats.activeCampaigns}
          hint={`${stats.campaignCount} total`}
          icon={Megaphone}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Send volume</CardTitle>
          <CardDescription>
            Outbound sends vs replies over the last 14 days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats.sentCount === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <BarChart3 className="text-muted-foreground size-8" />
              <p className="text-sm text-muted-foreground">
                Launch a campaign to start seeing volume here.
              </p>
            </div>
          ) : (
            <SendTrendChart data={trend} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Campaign funnel</CardTitle>
          <CardDescription>
            Total leads → sent → replied → interested, per campaign.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CampaignFunnel rows={funnel} />
        </CardContent>
      </Card>
    </div>
  );
}
