import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { readSheetTab } from "@/lib/google/sheets";

export const dynamic = "force-dynamic";

/**
 * Read a spreadsheet tab's headers and a small preview of rows, so the user
 * can confirm the sheet looks right before importing.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    spreadsheetId?: string;
    sheetName?: string;
  } | null;
  if (!body?.spreadsheetId || !body?.sheetName) {
    return NextResponse.json({ error: "spreadsheetId and sheetName are required" }, { status: 400 });
  }

  const spreadsheet = await prisma.spreadsheet.findFirst({
    where: { id: body.spreadsheetId, userId: user.id },
    include: { googleConnection: true },
  });
  if (!spreadsheet) {
    return NextResponse.json({ error: "Spreadsheet not found" }, { status: 404 });
  }

  try {
    const data = await readSheetTab(
      spreadsheet.googleConnection,
      spreadsheet.spreadsheetId,
      body.sheetName,
      6, // headers + 5 preview rows
    );
    return NextResponse.json({
      headers: data.headers,
      preview: data.rows.slice(0, 5),
      rowCount: data.rows.length,
    });
  } catch (error) {
    console.error("[sheets/tabs] failed:", error);
    return NextResponse.json(
      { error: "Could not read that tab — check the name and that the account can access the sheet" },
      { status: 400 },
    );
  }
}
