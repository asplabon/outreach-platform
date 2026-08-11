import { cache } from "react";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/** Current signed-in user (server-side), or null. Cached per request. */
export const getCurrentUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  return user;
});

/** True when a request is authenticated. */
export async function isAuthenticated(): Promise<boolean> {
  const session = await auth();
  return Boolean(session?.user);
}
