import { getSheetsClient } from "@/lib/google/client";
import type { GoogleConnection } from "@prisma/client";

export interface SheetTab {
  sheetId: number;
  title: string;
  gridRows: number;
  gridCols: number;
}

export interface SpreadsheetMeta {
  spreadsheetId: string;
  title: string;
  url: string;
  tabs: SheetTab[];
}

/** True when the given string looks like a Google Sheets id or URL. */
export function parseSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  // URLs look like https://docs.google.com/spreadsheets/d/<ID>/edit#gid=...
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9-_]{10,}$/.test(trimmed)) return trimmed;
  throw new Error(
    "That doesn't look like a Google Sheets URL or id — paste the full spreadsheet URL",
  );
}

export async function getSpreadsheetMeta(
  connection: GoogleConnection,
  spreadsheetId: string,
): Promise<SpreadsheetMeta> {
  const sheets = await getSheetsClient(connection);
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    fields:
      "spreadsheetId,properties(title),sheets(sheetId,title,gridProperties(columnCount,rowCount))",
  });
  const tabs: SheetTab[] =
    res.data.sheets?.map((sheet) => ({
      sheetId: sheet.properties?.sheetId ?? 0,
      title: sheet.properties?.title ?? "Sheet1",
      gridRows: sheet.properties?.gridProperties?.rowCount ?? 0,
      gridCols: sheet.properties?.gridProperties?.columnCount ?? 0,
    })) ?? [];
  return {
    spreadsheetId: res.data.spreadsheetId ?? spreadsheetId,
    title: res.data.properties?.title ?? spreadsheetId,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    tabs,
  };
}

export interface SheetData {
  headers: string[];
  rows: Record<string, string>[];
  /** Row numbers (1-indexed in the sheet) for each row, used to write back. */
  rowNumbers: number[];
}

/**
 * Read a tab's header row + data rows. Skips completely-empty trailing rows.
 */
export async function readSheetTab(
  connection: GoogleConnection,
  spreadsheetId: string,
  sheetName: string,
  maxRows = 5000,
): Promise<SheetData> {
  const sheets = await getSheetsClient(connection);
  // Read the header row first so we only request the columns that exist.
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:ZZ1`,
    majorDimension: "ROWS",
  });
  const headers = ((headerRes.data.values?.[0] ?? []) as string[]).map((h) =>
    h.trim(),
  );
  const colCount = Math.max(headers.length, 1);
  const range = `${sheetName}!A1:${columnToLetter(colCount)}${maxRows + 1}`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    majorDimension: "ROWS",
  });
  const values: string[][] = (res.data.values ?? []) as string[][];
  const rows: Record<string, string>[] = [];
  const rowNumbers: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const raw = values[i];
    if (!raw || raw.every((cell) => !cell?.trim())) continue;
    const row: Record<string, string> = {};
    headers.forEach((header, col) => {
      if (header) row[header] = (raw[col] ?? "").trim();
    });
    rows.push(row);
    rowNumbers.push(i + 1); // data rows are offset by the header row
  }
  return { headers, rows, rowNumbers };
}

export interface CellWrite {
  /** 1-indexed row within the sheet (header is row 1). */
  rowNumber: number;
  value: string;
}

/**
 * Write values into a single column (given by A1 letter) in one batched
 * request. Only the exact cells listed are touched — gaps between rows are
 * left alone, so unrelated rows are never cleared.
 */
export async function writeCellValues(
  connection: GoogleConnection,
  spreadsheetId: string,
  sheetName: string,
  column: string, // A1 column letter, e.g. "F"
  writes: CellWrite[],
): Promise<void> {
  if (writes.length === 0) return;
  const sheets = await getSheetsClient(connection);
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: writes.map((w) => ({
        range: `${sheetName}!${column}${w.rowNumber}`,
        values: [[w.value]],
      })),
    },
  });
}

/** A1-notation column letter for the given 1-indexed column. */
export function columnToLetter(col: number): string {
  let letter = "";
  let n = col;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter || "Z";
}

