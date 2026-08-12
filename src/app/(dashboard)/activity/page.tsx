import {
  Activity as ActivityIcon,
  Bell,
  Bot,
  CheckCircle2,
  Inbox,
  Mail,
  MailX,
  Megaphone,
  Pause,
  Reply,
  type LucideIcon,
} from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import {
  getNotifications,
  getRecentActivity,
} from "@/lib/analytics/analytics";
import { formatRelative } from "@/lib/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarkAllReadButton } from "@/components/activity/mark-all-read-button";

const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  EMAIL_SENT: Mail,
  EMAIL_FAILED: MailX,
  EMAIL_BOUNCED: MailX,
  CAMPAIGN_STARTED: Megaphone,
  CAMPAIGN_PAUSED: Pause,
  REPLY_RECEIVED: Reply,
  AUTO_REPLY_RECEIVED: Reply,
  UNSUBSCRIBED: MailX,
  AI_CLASSIFIED: Bot,
  AI_REPLY_SENT: Bot,
};

const ACTIVITY_COLORS: Record<string, string> = {
  EMAIL_SENT: "bg-primary/10 text-primary",
  EMAIL_FAILED: "bg-destructive/10 text-destructive",
  EMAIL_BOUNCED: "bg-destructive/10 text-destructive",
  CAMPAIGN_STARTED: "bg-chart-3/15 text-chart-3",
  CAMPAIGN_PAUSED: "bg-muted text-muted-foreground",
  REPLY_RECEIVED: "bg-chart-2/15 text-chart-2",
  AUTO_REPLY_RECEIVED: "bg-chart-2/15 text-chart-2",
  UNSUBSCRIBED: "bg-destructive/10 text-destructive",
  AI_CLASSIFIED: "bg-primary/10 text-primary",
  AI_REPLY_SENT: "bg-primary/10 text-primary",
};

export default async function ActivityPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [activity, notifications] = await Promise.all([
    getRecentActivity(user.id, 50),
    getNotifications(user.id),
  ]);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="text-muted-foreground text-sm">
          Your system events and notifications, newest first.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ActivityIcon className="size-4" />
              Event feed
            </CardTitle>
            <CardDescription>
              Every send, reply, and pipeline event for your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Inbox className="text-muted-foreground size-8" />
                <p className="text-sm text-muted-foreground">
                  No activity yet — events appear as campaigns send and replies
                  come in.
                </p>
              </div>
            ) : (
              <ul className="divide-y">
                {activity.map((item) => {
                  const Icon = ACTIVITY_ICONS[item.type] ?? ActivityIcon;
                  const color =
                    ACTIVITY_COLORS[item.type] ?? "bg-muted text-muted-foreground";
                  return (
                    <li key={item.id} className="flex items-start gap-3 py-3">
                      <span
                        className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${color}`}
                      >
                        <Icon className="size-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{item.message}</p>
                        <p className="text-muted-foreground text-xs">
                          {formatRelative(item.createdAt)}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {item.type.replace(/_/g, " ").toLowerCase()}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="size-4" />
              Notifications
              {unreadCount > 0 ? (
                <Badge variant="destructive" className="ml-1">
                  {unreadCount}
                </Badge>
              ) : null}
            </CardTitle>
            <MarkAllReadButton />
          </CardHeader>
          <CardContent>
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <CheckCircle2 className="text-muted-foreground size-8" />
                <p className="text-sm text-muted-foreground">
                  You are all caught up.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className={`flex items-start gap-2 text-sm ${n.read ? "opacity-60" : ""}`}
                  >
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-chart-2" />
                    <div>
                      <p>{n.message}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatRelative(n.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
