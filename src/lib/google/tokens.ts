import { prisma } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/security/crypto";
import { getOAuth2Client } from "@/lib/google/oauth";
import type { GoogleConnection, Mailbox } from "@prisma/client";

/** Decrypted view of the tokens stored on a GoogleConnection row. */
export interface DecryptedTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}

export function decryptTokens(
  connection: Pick<
    GoogleConnection,
    "accessToken" | "refreshToken" | "expiresAt"
  >,
): DecryptedTokens {
  return {
    accessToken: decryptSecret(connection.accessToken),
    refreshToken: connection.refreshToken
      ? decryptSecret(connection.refreshToken)
      : null,
    expiresAt: connection.expiresAt,
  };
}

export interface ExchangeResult {
  email: string;
  scope: string[];
  tokens: {
    accessToken: string;
    refreshToken?: string | null;
    expiresAt: Date | null;
  };
}

/**
 * Exchange the OAuth `code` from the callback for tokens and identify the
 * authorizing Google account. Runs server-side; tokens never leave the server.
 */
export async function exchangeCodeForTokens(
  code: string,
): Promise<ExchangeResult> {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  const info = await client.getTokenInfo(tokens.access_token as string);
  if (!info.email) {
    throw new Error("Google did not return an account email");
  }
  return {
    email: info.email,
    scope: (info.scopes ?? []).filter(Boolean),
    tokens: {
      accessToken: tokens.access_token as string,
      refreshToken: (tokens.refresh_token as string | undefined) ?? null,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    },
  };
}

/**
 * Persist the exchanged tokens: upsert the GoogleConnection (one per
 * user+email) and the Mailbox (one per user+email). Tokens are stored
 * AES-256-GCM encrypted.
 */
export async function saveConnection(
  userId: string,
  result: ExchangeResult,
): Promise<{ connection: GoogleConnection; mailbox: Mailbox }> {
  const connection = await prisma.googleConnection.upsert({
    where: { userId_email: { userId, email: result.email } },
    update: {
      accessToken: encryptSecret(result.tokens.accessToken),
      refreshToken: result.tokens.refreshToken
        ? encryptSecret(result.tokens.refreshToken)
        : null,
      expiresAt: result.tokens.expiresAt,
      status: "CONNECTED",
      lastError: null,
      updatedAt: new Date(),
    },
    create: {
      userId,
      provider: "google",
      email: result.email,
      scopes: result.scope,
      accessToken: encryptSecret(result.tokens.accessToken),
      refreshToken: result.tokens.refreshToken
        ? encryptSecret(result.tokens.refreshToken)
        : null,
      expiresAt: result.tokens.expiresAt,
      status: "CONNECTED",
    },
  });

  const mailbox = await prisma.mailbox.upsert({
    where: { userId_emailAddress: { userId, emailAddress: result.email } },
    update: {
      googleConnectionId: connection.id,
      status: "ACTIVE",
      lastError: null,
      updatedAt: new Date(),
    },
    create: {
      userId,
      googleConnectionId: connection.id,
      emailAddress: result.email,
      status: "ACTIVE",
      isDefault: false,
    },
  });

  return { connection, mailbox };
}

/**
 * Return a fresh (non-expired) access token for a connection, refreshing and
 * persisting if it is expired or expiring within 60 seconds.
 */
export async function ensureFreshAccessToken(
  connection: GoogleConnection,
): Promise<{ accessToken: string; expiresAt: Date | null }> {
  const tokens = decryptTokens(connection);
  if (!tokens.refreshToken) {
    // No refresh token (shouldn't happen — we always request offline access):
    // the connection is broken; the user must re-authorize.
    throw new Error("Connection has no refresh token; re-authorize");
  }

  const expiresInMs = tokens.expiresAt
    ? tokens.expiresAt.getTime() - Date.now()
    : 0;
  // Buffer of 60s so we never send a token that is about to expire.
  if (tokens.expiresAt && expiresInMs > 60_000) {
    return { accessToken: tokens.accessToken, expiresAt: tokens.expiresAt };
  }

  const client = getOAuth2Client();
  client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    token_type: "Bearer",
  });
  const { credentials } = await client.refreshAccessToken();
  const newExpiresAt = credentials.expiry_date
    ? new Date(credentials.expiry_date)
    : null;

  await prisma.googleConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: encryptSecret(credentials.access_token as string),
      expiresAt: newExpiresAt,
      status: "CONNECTED",
      lastError: null,
    },
  });

  return {
    accessToken: credentials.access_token as string,
    expiresAt: newExpiresAt,
  };
}
