import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Disconnect a Google connection (and everything cascading from it: mailboxes,
 * spreadsheets, mappings). The encrypted tokens are destroyed on delete.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    connectionId?: string;
  } | null;
  const connectionId = body?.connectionId;
  if (!connectionId) {
    return NextResponse.json({ error: "connectionId is required" }, { status: 400 });
  }

  const connection = await prisma.googleConnection.findFirst({
    where: { id: connectionId, userId: user.id },
    select: { id: true },
  });
  if (!connection) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  await prisma.googleConnection.delete({ where: { id: connection.id } });
  return NextResponse.json({ ok: true });
}
