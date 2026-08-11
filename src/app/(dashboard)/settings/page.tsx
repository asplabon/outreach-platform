import Link from "next/link";
import { KeyRound, Mailbox, Bell, FileSpreadsheet } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const mailboxCount = await prisma.mailbox.count({ where: { userId: user.id } });
  const spreadsheetCount = await prisma.spreadsheet.count({
    where: { userId: user.id },
  });

  const initials = (user.name ?? user.email)
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const rows: { label: string; value: string }[] = [
    { label: "Name", value: user.name ?? "—" },
    { label: "Email", value: user.email },
    { label: "Role", value: user.role },
    { label: "Member since", value: formatDate(user.createdAt) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Manage your account and integrations.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>
              Your profile and sign-in information.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Avatar className="size-14 rounded-full">
                {user.image ? (
                  <AvatarImage src={user.image} alt={user.name ?? "User"} />
                ) : null}
                <AvatarFallback className="rounded-full text-lg">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-lg font-medium">{user.name ?? "User"}</p>
                <p className="text-muted-foreground text-sm">{user.email}</p>
              </div>
            </div>
            <dl className="mt-6 grid gap-3 sm:grid-cols-2">
              {rows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                >
                  <dt className="text-muted-foreground text-sm">{row.label}</dt>
                  <dd className="text-sm font-medium">{row.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Integrations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <IntegrationRow
                icon={Mailbox}
                label="Mailboxes"
                value={`${mailboxCount} connected`}
                href="/mailboxes"
              />
              <IntegrationRow
                icon={FileSpreadsheet}
                label="Google Sheets"
                value={`${spreadsheetCount} connected`}
                href="/sheets"
              />
              <IntegrationRow
                icon={KeyRound}
                label="AI provider"
                value="demo"
                phase="Phase 6"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Notifications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Bell className="text-muted-foreground size-4" />
                <p className="text-muted-foreground text-sm">
                  Notification preferences land with Phase 7.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function IntegrationRow({
  icon: Icon,
  label,
  value,
  href,
  phase,
}: {
  icon: typeof Mailbox;
  label: string;
  value: string;
  href?: string;
  phase?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-3">
        <div className="bg-muted flex size-8 items-center justify-center rounded-md">
          <Icon className="text-muted-foreground size-4" />
        </div>
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-muted-foreground text-xs">{value}</p>
        </div>
      </div>
      {href ? (
        <Badge variant="outline" className="hover:bg-muted">
          <Link href={href}>Manage</Link>
        </Badge>
      ) : phase ? (
        <Badge variant="outline">{phase}</Badge>
      ) : null}
    </div>
  );
}
