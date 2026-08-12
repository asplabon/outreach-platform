import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { syncRepliesForAllUsers } from "@/lib/replies/sync";

export const dynamic = "force-dynamic";

/**
 * Manually trigger a reply-sync pass across the user's active mailboxes.
 * The periodic worker (repeatable job / dev interval) also runs this, but an
 * explicit trigger is handy in development and for testing.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const summary = await syncRepliesForAllUsers();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("[replies/sync] failed:", error);
    return NextResponse.json({ error: "Could not sync replies" }, { status: 500 });
  }
}
