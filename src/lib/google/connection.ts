import { prisma } from "@/lib/db";
import type { GoogleConnection } from "@prisma/client";

/** The user's most recently connected Google account, or throw. */
export async function requireGoogleConnection(
  userId: string,
): Promise<GoogleConnection> {
  const connection = await prisma.googleConnection.findFirst({
    where: { userId, status: "CONNECTED" },
    orderBy: { updatedAt: "desc" },
  });
  if (!connection) {
    throw new Error("No connected Google account — connect a mailbox first");
  }
  return connection;
}
