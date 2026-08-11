import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getCurrentUser } from "@/lib/auth/session";
import {
  buildAuthUrl,
  hasGoogleCredentials,
  newOAuthState,
} from "@/lib/google/oauth";

export const dynamic = "force-dynamic";

/**
 * Start mailbox authorization: redirect to Google consent with a CSRF-guarded
 * state cookie. The callback (/api/google/callback) exchanges the code.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasGoogleCredentials()) {
    return NextResponse.json(
      { error: "Google OAuth is not configured (see GOOGLE_CLOUD_SETUP.md)" },
      { status: 400 },
    );
  }

  const state = newOAuthState();
  (await cookies()).set("google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes to complete the flow
  });

  return NextResponse.redirect(buildAuthUrl(state));
}
