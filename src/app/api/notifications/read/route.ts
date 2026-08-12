import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { markNotificationsRead } from "@/lib/analytics/analytics";

export const dynamic = "force-dynamic";

/** Mark all of the signed-in user's notifications as read. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const count = await markNotificationsRead(user.id);
  return NextResponse.json({ ok: true, marked: count });
}
