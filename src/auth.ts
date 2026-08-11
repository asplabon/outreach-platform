import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

import { env } from "@/lib/env";
import { prisma } from "@/lib/db";

/**
 * NextAuth v5 (Auth.js) configuration.
 *
 * Two clearly separate authorizations:
 *   1. Application sign-in (this file) — Google OAuth (openid/email/profile)
 *      plus an optional, strictly-gated dev-only login fallback.
 *   2. Google mailbox authorization (Gmail + Sheets scopes) — a separate OAuth
 *      flow in lib/google (Phase 2), whose tokens are stored encrypted.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  secret: env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/signin",
  },
  providers: [
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    // Dev-only fallback so the app is usable before Google Cloud setup.
    // Never enabled in production semantics: gated by env flags.
    ...(env.AUTH_ALLOW_DEV_LOGIN && env.DEV_LOGIN_EMAIL
      ? [
          Credentials({
            id: "dev-login",
            name: "Dev login",
            credentials: {
              email: { label: "Email", type: "email" },
            },
            async authorize(credentials) {
              if (!env.AUTH_ALLOW_DEV_LOGIN) return null;
              const email =
                typeof credentials?.email === "string"
                  ? credentials.email.trim().toLowerCase()
                  : "";
              if (!email) return null;
              if (env.DEV_LOGIN_EMAIL && email !== env.DEV_LOGIN_EMAIL.toLowerCase()) {
                return null;
              }
              return { id: email, email, name: "Dev User" };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    // Runs on sign-in (user is present only then). Upsert the DB user and stash
    // its id on the token. On later reads `user` is undefined → no DB hit.
    async jwt({ token, user }) {
      if (user?.email) {
        const dbUser = await prisma.user.upsert({
          where: { email: user.email },
          update: {
            name: user.name ?? undefined,
            image: user.image ?? undefined,
          },
          create: {
            email: user.email,
            name: user.name,
            image: user.image,
          },
        });
        token.userId = dbUser.id;
        token.role = dbUser.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.userId as string) ?? session.user.email ?? "";
        session.user.role = (token.role as string) ?? "USER";
      }
      return session;
    },
  },
});
