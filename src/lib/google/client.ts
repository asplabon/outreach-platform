import { google, type Auth, type gmail_v1, type sheets_v4 } from "googleapis";

import { getOAuth2Client } from "@/lib/google/oauth";
import {
  decryptTokens,
  ensureFreshAccessToken,
} from "@/lib/google/tokens";
import type { GoogleConnection } from "@prisma/client";

/**
 * Build an authenticated googleapis client for a stored GoogleConnection.
 * Always called with a fresh access token (refreshed + persisted if needed).
 */
export async function getAuthorizedClient(
  connection: GoogleConnection,
): Promise<Auth.OAuth2Client> {
  const { refreshToken } = decryptTokens(connection);
  const fresh = await ensureFreshAccessToken(connection);
  const client = getOAuth2Client();
  client.setCredentials({
    access_token: fresh.accessToken,
    refresh_token: refreshToken ?? undefined,
    token_type: "Bearer",
  });
  return client;
}

export async function getGmailClient(
  connection: GoogleConnection,
): Promise<gmail_v1.Gmail> {
  const auth = await getAuthorizedClient(connection);
  return google.gmail({ version: "v1", auth });
}

export async function getSheetsClient(
  connection: GoogleConnection,
): Promise<sheets_v4.Sheets> {
  const auth = await getAuthorizedClient(connection);
  return google.sheets({ version: "v4", auth });
}
