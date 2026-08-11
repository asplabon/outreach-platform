import { FileSpreadsheet } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { hasGoogleCredentials } from "@/lib/google/oauth";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SheetsConnect } from "@/components/sheets/sheets-connect";

export const dynamic = "force-dynamic";

export default async function SheetsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [spreadsheets, googleConnections] = await Promise.all([
    prisma.spreadsheet.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { sheetMapping: true },
    }),
    prisma.googleConnection.findMany({
      where: { userId: user.id, status: "CONNECTED" },
      take: 1,
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Lead spreadsheets
        </h1>
        <p className="text-muted-foreground text-sm">
          Connect Google Sheets as a lead source and sync statuses back to it.
        </p>
      </div>

      <SheetsConnect
        googleConfigured={hasGoogleCredentials()}
        hasConnection={googleConnections.length > 0}
      />

      <Card>
        <CardHeader>
          <CardTitle>Connected spreadsheets</CardTitle>
          <CardDescription>
            Sheets you&apos;ve connected for lead import and status sync.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {spreadsheets.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <FileSpreadsheet className="text-muted-foreground size-8" />
              <p className="text-sm text-muted-foreground">
                No spreadsheets connected yet.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {spreadsheets.map((spreadsheet) => (
                <li
                  key={spreadsheet.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <a
                      href={spreadsheet.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-sm font-medium hover:underline"
                    >
                      {spreadsheet.title}
                    </a>
                    <p className="text-muted-foreground text-xs">
                      {spreadsheet.sheetMapping?.sheetName ?? "No mapping yet"} ·{" "}
                      {spreadsheet.sheetMapping?.importedCount ?? 0} leads
                      imported · added {formatDate(spreadsheet.createdAt)}
                    </p>
                  </div>
                  <Badge variant={spreadsheet.sheetMapping ? "default" : "outline"}>
                    {spreadsheet.sheetMapping ? "Mapped" : "Not mapped"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
