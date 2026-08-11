import { randomBytes } from "crypto";
import { google } from "googleapis";

import { env } from "@/lib/env";

/**
 * Mailbox authorization — separate from app sign-in. Requests the Gmail and
 * Sheets scopes the app actually needs, plus userinfo to know who authorized.
 * App sign-in (NextAuth) stays scoped to openid/email/profile.
 */
export const GOOGLE_MAILBOX_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

/** True when Google OAuth credentials are configured (required to connect). */
export function hasGoogleCredentials(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function getOAuth2Client() {
  if (!hasGoogleCredentials()) {
    throw new Error("Google OAuth is not configured (see GOOGLE_CLOUD_SETUP.md)");
  }
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI,
  );
}

/**
 * Build the consent-screen URL. `access_type: offline` + `prompt: consent`
 * guarantees a refresh token on every authorization, so we never lose the
 * ability to refresh. The `state` value guards against CSRF on the callback.
 */
export function buildAuthUrl(state: string): string {
  return getOAuth2Client().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_MAILBOX_SCOPES,
    state,
    include_granted_scopes: true,
  });
}

/** Random unguessable state token (stored in a cookie, checked on callback). */
export function newOAuthState(): string {
  return randomBytes(24).toString("hex");
}
