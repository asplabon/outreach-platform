import { prisma } from "@/lib/db";
import {
  columnToLetter,
  readSheetTab,
  writeCellValues,
  type CellWrite,
} from "@/lib/google/sheets";
import type { QueueJob } from "@/lib/queue";
import type { FieldMapping } from "@/lib/leads/mapping";

export interface SyncCampaignStatusJob {
  campaignId: string;
}

export interface SyncCampaignStatusResult {
  matchedRows: number;
}

/**
 * Write each campaign lead's status back into the mapped "status" column of
 * the campaign's spreadsheet, keyed by the mapped email column. Only cells
 * that correspond to a campaign lead are touched.
 *
 * Invoked by the sheet-sync queue (`sheetSync`). Campaigns call this via
 * enqueue("sheetSync", "sync-campaign-status", { campaignId }) once they have
 * leads (Phase 3+).
 */
export async function syncCampaignStatus(
  job: QueueJob<SyncCampaignStatusJob>,
): Promise<SyncCampaignStatusResult> {
  const { campaignId } = job.data;
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      spreadsheet: {
        include: { sheetMapping: true, googleConnection: true },
      },
      campaignLeads: { include: { lead: true } },
    },
  });
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);
  if (!campaign.spreadsheet?.sheetMapping) {
    console.log(
      `[sheet-sync] campaign ${campaignId} has no mapped spreadsheet — nothing to sync`,
    );
    return { matchedRows: 0 };
  }

  const mapping = campaign.spreadsheet.sheetMapping.fieldMapping as FieldMapping;
  const emailHeader = Object.keys(mapping).find((h) => mapping[h] === "email");
  const statusHeader = Object.keys(mapping).find((h) => mapping[h] === "status");
  if (!emailHeader || !statusHeader) {
    console.log(
      `[sheet-sync] mapping for campaign ${campaignId} lacks email/status columns — nothing to sync`,
    );
    return { matchedRows: 0 };
  }

  const sheetMapping = campaign.spreadsheet.sheetMapping;
  const connection = campaign.spreadsheet.googleConnection;
  const data = await readSheetTab(
    connection,
    campaign.spreadsheet.spreadsheetId,
    sheetMapping.sheetName,
  );

  const emailToRow = new Map<string, number>();
  data.rows.forEach((row, i) => {
    const email = (row[emailHeader] ?? "").toLowerCase();
    if (email) emailToRow.set(email, data.rowNumbers[i]);
  });

  const writes: CellWrite[] = [];
  for (const cl of campaign.campaignLeads) {
    const rowNumber = emailToRow.get(cl.lead.email.toLowerCase());
    if (!rowNumber) continue;
    writes.push({ rowNumber, value: cl.status });
  }

  if (writes.length > 0) {
    const statusColIndex = data.headers.indexOf(statusHeader);
    if (statusColIndex === -1) {
      throw new Error(
        `Status column "${statusHeader}" not found in sheet "${sheetMapping.sheetName}"`,
      );
    }
    await writeCellValues(
      connection,
      campaign.spreadsheet.spreadsheetId,
      sheetMapping.sheetName,
      columnToLetter(statusColIndex + 1),
      writes,
    );
  }

  await prisma.spreadsheet.update({
    where: { id: campaign.spreadsheet.id },
    data: { lastSyncedAt: new Date() },
  });

  return { matchedRows: writes.length };
}
