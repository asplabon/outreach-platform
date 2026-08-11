import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/auth";
import { env } from "@/lib/env";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = {
  title: "Sign in — Outreach Platform",
};

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <SignInForm
      googleEnabled={Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)}
      devLoginAllowed={env.AUTH_ALLOW_DEV_LOGIN && Boolean(env.DEV_LOGIN_EMAIL)}
      devEmail={env.DEV_LOGIN_EMAIL}
    />
  );
}
