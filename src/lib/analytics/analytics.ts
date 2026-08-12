import { prisma } from "@/lib/db";

/**
 * Analytics queries + pure helpers (Phase 7).
 *
 * The query layer is Prisma counts/aggregations scoped to one user; the pure
 * helpers (`buildTrend`, `toCsv`) are unit-tested. Everything here is read-only
 * except `notify`, which the pipeline uses to surface high-value events.
 */

export interface DashboardStats {
  leadCount: number;
  campaignCount: number;
  activeCampaigns: number;
  sentCount: number;
  repliedLeads: number;
  /** repliedLeads / sentCount (0 when nothing sent). */
  replyRate: number;
  bouncedCount: number;
  bounceRate: number;
  pendingAiReplies: number;
  unreadNotifications: number;
}

export interface TrendPoint {
  /** Local calendar date, yyyy-MM-dd (stable key for charts). */
  iso: string;
  /** Human label, e.g. "Aug 10". */
  label: string;
  sent: number;
  replied: number;
}

export interface CampaignFunnelRow {
  campaignId: string;
  name: string;
  total: number;
  sent: number;
  replied: number;
  interested: number;
}

export interface ActivityItem {
  id: string;
  type: string;
  message: string;
  createdAt: Date;
  /** Notifications only — whether the user has read it. */
  read?: boolean;
}

/** KPI totals for the dashboard + analytics header. */
export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const [leadCount, campaignCount, activeCampaigns, sentCount, repliedLeads, bouncedCount, pendingAiReplies, unreadNotifications] =
    await Promise.all([
      prisma.lead.count({ where: { userId } }),
      prisma.campaign.count({ where: { userId } }),
      prisma.campaign.count({ where: { userId, status: "RUNNING" } }),
      prisma.message.count({ where: { lead: { userId }, direction: "SENT", status: "SENT" } }),
      prisma.reply
        .groupBy({ by: ["leadId"], where: { lead: { userId } }, _count: { _all: true } })
        .then((groups) => groups.length),
      prisma.message.count({
        where: { lead: { userId }, direction: "SENT", status: "BOUNCED" },
      }),
      prisma.aiReply.count({
        where: { lead: { userId }, status: { in: ["PENDING_REVIEW", "ESCALATED"] } },
      }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

  return {
    leadCount,
    campaignCount,
    activeCampaigns,
    sentCount,
    repliedLeads,
    replyRate: sentCount > 0 ? repliedLeads / sentCount : 0,
    bouncedCount,
    bounceRate: sentCount > 0 ? bouncedCount / sentCount : 0,
    pendingAiReplies,
    unreadNotifications,
  };
}

/** Sent / replied counts bucketed per day over the last `days` days. */
export async function getSendTrend(
  userId: string,
  days = 14,
  now = new Date(),
): Promise<TrendPoint[]> {
  const since = new Date(now);
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  const [sent, replied] = await Promise.all([
    prisma.message.findMany({
      where: {
        lead: { userId },
        direction: "SENT",
        status: "SENT",
        sentAt: { gte: since },
      },
      select: { sentAt: true },
    }),
    prisma.reply.findMany({
      where: { lead: { userId }, receivedAt: { gte: since } },
      select: { receivedAt: true },
    }),
  ]);

  return buildTrend(
    sent.map((m) => m.sentAt ?? now),
    replied.map((r) => r.receivedAt),
    days,
    now,
  );
}

/** Per-campaign funnel: total → sent → replied → interested (meeting). */
export async function getCampaignFunnel(userId: string): Promise<CampaignFunnelRow[]> {
  const campaigns = await prisma.campaign.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      campaignLeads: { select: { status: true, lead: { select: { status: true } } } },
    },
  });

  return campaigns.map((c) => {
    let total = 0;
    let sent = 0;
    let replied = 0;
    let interested = 0;
    for (const cl of c.campaignLeads) {
      total += 1;
      if (cl.status !== "PENDING") sent += 1;
      if (cl.status === "REPLIED") replied += 1;
      if (cl.lead.status === "MEETING" || cl.lead.status === "INTERESTED") interested += 1;
    }
    return {
      campaignId: c.id,
      name: c.name,
      total,
      sent,
      replied,
      interested,
    };
  });
}

/** Most recent activity-log lines. */
export async function getRecentActivity(userId: string, limit = 20): Promise<ActivityItem[]> {
  return prisma.activityLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, type: true, message: true, createdAt: true },
  });
}

/** Unread notifications, newest first. */
export async function getNotifications(userId: string): Promise<ActivityItem[]> {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, type: true, title: true, message: true, createdAt: true, readAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    message: r.message ? `${r.title} — ${r.message}` : r.title,
    createdAt: r.createdAt,
    read: r.readAt !== null,
  }));
}

export async function markNotificationsRead(userId: string): Promise<number> {
  const res = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return res.count;
}

/** Create a notification (best-effort, never throws). */
export async function notify(
  userId: string,
  type: string,
  title: string,
  message?: string,
): Promise<void> {
  try {
    await prisma.notification.create({
      data: { userId, type, title, message },
    });
  } catch (error) {
    console.error(`[activity] notification (${type}) failed:`, error);
  }
}

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested)
// ---------------------------------------------------------------------------

function localDateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Bucket send/reply timestamps into `days` consecutive local days ending today
 * (zero-filled). Pure so the chart contract is unit-testable.
 */
export function buildTrend(
  sentAt: Date[],
  repliedAt: Date[],
  days: number,
  now = new Date(),
): TrendPoint[] {
  const points: TrendPoint[] = [];
  const index = new Map<string, number>();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));

  for (let i = 0; i < days; i += 1) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const iso = localDateKey(d);
    index.set(iso, i);
    points.push({
      iso,
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      sent: 0,
      replied: 0,
    });
  }

  const bump = (list: Date[], field: "sent" | "replied") => {
    for (const at of list) {
      const i = index.get(localDateKey(at));
      if (i !== undefined) points[i][field] += 1;
    }
  };
  bump(sentAt, "sent");
  bump(repliedAt, "replied");
  return points;
}

/** Percent helper with a sane display (0.123 → "12%"). */
export function percent(ratio: number, digits = 0): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** Serialize rows to CSV with RFC-4180-ish quoting. Pure + testable. */
export function toCsv(rows: Array<Record<string, string | number>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: string | number): string => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ];
  return lines.join("\n");
}
