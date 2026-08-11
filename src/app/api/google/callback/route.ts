import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getCurrentUser } from "@/lib/auth/session";
import { exchangeCodeForTokens, saveConnection } from "@/lib/google/tokens";

export const dynamic = "force-dynamic";

/**
 * OAuth callback for mailbox authorization. Verifies the state cookie, swaps
 * the code for tokens, persists the encrypted connection + mailbox, then
 * redirects back to the app.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (!user) {
    return NextResponse.redirect(new URL("/signin", url.origin));
  }

  const fail = (message: string) => {
    const target = new URL("/mailboxes", url.origin);
    target.searchParams.set("error", message);
    return NextResponse.redirect(target);
  };

  if (oauthError) {
    return fail(`Google authorization was not completed (${oauthError}).`);
  }
  if (!code || !state) {
    return fail("Authorization failed: missing code or state.");
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("google_oauth_state")?.value;
  cookieStore.delete("google_oauth_state");
  if (!expectedState || expectedState !== state) {
    return fail("Authorization failed: state mismatch. Please try again.");
  }

  try {
    const result = await exchangeCodeForTokens(code);
    await saveConnection(user.id, result);
    const target = new URL("/mailboxes", url.origin);
    target.searchParams.set("connected", "1");
    return NextResponse.redirect(target);
  } catch (error) {
    console.error("[google/callback] token exchange failed:", error);
    return fail(
      "Could not complete the Google connection. Check the redirect URI and that the app is enabled in Google Cloud.",
    );
  }
}
