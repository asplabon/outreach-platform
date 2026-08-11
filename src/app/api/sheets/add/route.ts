import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { requireGoogleConnection } from "@/lib/google/connection";
import {
  getSpreadsheetMeta,
  parseSpreadsheetId,
} from "@/lib/google/sheets";

export const dynamic = "force-dynamic";

/**
 * Add a Google Sheet by URL/id: fetch its metadata + tabs, store the
 * Spreadsheet row, return tabs for the user to pick one.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { url?: string } | null;
  if (!body?.url?.trim()) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    const connection = await requireGoogleConnection(user.id);
    const spreadsheetId = parseSpreadsheetId(body.url);
    const meta = await getSpreadsheetMeta(connection, spreadsheetId);

    const spreadsheet = await prisma.spreadsheet.upsert({
      where: { userId_spreadsheetId: { userId: user.id, spreadsheetId } },
      update: { title: meta.title, url: meta.url, googleConnectionId: connection.id },
      create: {
        userId: user.id,
        googleConnectionId: connection.id,
        spreadsheetId,
        title: meta.title,
        url: meta.url,
      },
    });

    const existingMapping = await prisma.sheetMapping.findUnique({
      where: { spreadsheetId: spreadsheet.id },
    });

    return NextResponse.json({
      spreadsheet: {
        id: spreadsheet.id,
        spreadsheetId: spreadsheet.spreadsheetId,
        title: spreadsheet.title,
        url: spreadsheet.url,
        tabs: meta.tabs,
      },
      mapping: existingMapping ?? null,
    });
  } catch (error) {
    console.error("[sheets/add] failed:", error);
    const message = error instanceof Error ? error.message : "Could not read that spreadsheet";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
