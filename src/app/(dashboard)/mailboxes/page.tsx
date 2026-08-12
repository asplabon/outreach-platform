import Link from "next/link";
import { AlertTriangle, Mailbox as MailboxIcon, Plus, FileSpreadsheet } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { hasGoogleCredentials } from "@/lib/google/oauth";
import { formatDate } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { DisconnectButton } from "@/components/mailboxes/disconnect-button";

export const dynamic = "force-dynamic";

interface MailboxesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MailboxesPage({ searchParams }: MailboxesPageProps) {
  const user = await getCurrentUser();
  if (!user) return null;

  const params = await searchParams;
  const connected = params.connected === "1";
  const error = typeof params.error === "string" ? params.error : null;

  const mailboxes = await prisma.mailbox.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { googleConnection: true },
  });

  const googleConfigured = hasGoogleCredentials();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mailboxes</h1>
          <p className="text-muted-foreground text-sm">
            Authorize Gmail accounts that send and receive campaign email.
          </p>
        </div>
        {googleConfigured ? (
          <Button nativeButton={false} render={<a href="/api/google/connect" />}>
            <Plus />
            Connect Gmail
          </Button>
        ) : null}
      </div>

      {connected ? (
        <Alert>
          <MailboxIcon className="size-4" />
          <AlertTitle>Mailbox connected</AlertTitle>
          <AlertDescription>
            Your Google account is connected. You can now connect a lead
            spreadsheet on the Sheets page.
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Connection failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!googleConfigured ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Google OAuth is not configured</AlertTitle>
          <AlertDescription>
            Set <code>GOOGLE_CLIENT_ID</code> and{" "}
            <code>GOOGLE_CLIENT_SECRET</code> in your .env, then restart the
            server. Follow{" "}
            <a
              href="/GOOGLE_CLOUD_SETUP.md"
              className="underline underline-offset-2"
            >
              GOOGLE_CLOUD_SETUP.md
            </a>{" "}
            to create them.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Connected accounts</CardTitle>
          <CardDescription>
            Gmail sending and reply detection use these mailboxes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mailboxes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <MailboxIcon className="text-muted-foreground size-8" />
              <p className="text-sm text-muted-foreground">
                {googleConfigured
                  ? "No mailbox connected yet — click “Connect Gmail” to authorize."
                  : "Connect a mailbox once Google OAuth is configured."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Connected</TableHead>
                  <TableHead>Last synced</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mailboxes.map((mailbox) => (
                  <TableRow key={mailbox.id}>
                    <TableCell className="font-medium">
                      {mailbox.emailAddress}
                    </TableCell>
                    <TableCell>
                      <Badge variant={mailbox.status === "ACTIVE" ? "default" : "secondary"}>
                        {mailbox.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(mailbox.createdAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {mailbox.lastSyncedAt
                        ? formatDate(mailbox.lastSyncedAt)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <DisconnectButton connectionId={mailbox.googleConnectionId} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-4" />
            Lead spreadsheets
          </CardTitle>
          <CardDescription>
            Import leads from a Google Sheet and sync campaign statuses back to it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" nativeButton={false} render={<Link href="/sheets" />}>
            Manage lead spreadsheets
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
