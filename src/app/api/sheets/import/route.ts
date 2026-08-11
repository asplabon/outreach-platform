import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { readSheetTab } from "@/lib/google/sheets";
import { importLeads } from "@/lib/leads/import";
import {
  FIELD_TARGETS,
  type FieldMapping,
} from "@/lib/leads/mapping";

export const dynamic = "force-dynamic";

/**
 * Import a spreadsheet tab into leads using the user's column→field mapping.
 * Saves the mapping (SheetMapping) so re-imports and status sync reuse it.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    spreadsheetId?: string;
    sheetName?: string;
    fieldMapping?: FieldMapping;
  } | null;

  if (!body?.spreadsheetId || !body?.sheetName || !body?.fieldMapping) {
    return NextResponse.json(
      { error: "spreadsheetId, sheetName and fieldMapping are required" },
      { status: 400 },
    );
  }

  // Validate the mapping shape before trusting it.
  const mapping = body.fieldMapping;
  for (const [header, target] of Object.entries(mapping)) {
    if (!FIELD_TARGETS.includes(target)) {
      return NextResponse.json(
        { error: `Invalid field target for column "${header}"` },
        { status: 400 },
      );
    }
  }
  if (!Object.values(mapping).includes("email")) {
    return NextResponse.json(
      { error: "You must map at least one column to Email" },
      { status: 400 },
    );
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
    );
    const result = await importLeads(user.id, data.rows, mapping);

    await prisma.sheetMapping.upsert({
      where: { spreadsheetId: spreadsheet.id },
      update: {
        sheetName: body.sheetName,
        headerRow: data.headers,
        fieldMapping: mapping,
        importStatus: "IMPORTED",
        importedCount: result.created + result.updated,
      },
      create: {
        spreadsheetId: spreadsheet.id,
        sheetName: body.sheetName,
        headerRow: data.headers,
        fieldMapping: mapping,
        importStatus: "IMPORTED",
        importedCount: result.created + result.updated,
      },
    });

    await prisma.spreadsheet.update({
      where: { id: spreadsheet.id },
      data: { lastSyncedAt: new Date() },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[sheets/import] failed:", error);
    return NextResponse.json(
      { error: "Import failed — check the mapping and that the account can access the sheet" },
      { status: 400 },
    );
  }
}
