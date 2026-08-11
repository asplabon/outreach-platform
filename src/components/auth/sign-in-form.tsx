"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SignInFormProps = {
  googleEnabled: boolean;
  devLoginAllowed: boolean;
  devEmail: string;
};

export function SignInForm({
  googleEnabled,
  devLoginAllowed,
  devEmail,
}: SignInFormProps) {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [email, setEmail] = useState(devEmail ?? "");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    setLoading("google");
    setError(null);
    try {
      await signIn("google", { callbackUrl });
    } catch {
      setError("Could not start Google sign-in. Check your OAuth configuration.");
      setLoading(null);
    }
  }

  async function handleDevSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading("dev");
    setError(null);
    try {
      await signIn("dev-login", { email, callbackUrl });
    } catch {
      setError("Dev sign-in failed. The email must match DEV_LOGIN_EMAIL.");
      setLoading(null);
    }
  }

  const showDivider = googleEnabled && devLoginAllowed;

  return (
    <Card>
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-xl">Sign in</CardTitle>
        <CardDescription>
          AI Email Outreach & Automation Platform
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {googleEnabled ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogle}
              disabled={loading !== null}
            >
              {loading === "google" ? (
                <Loader2 className="animate-spin" />
              ) : null}
              Continue with Google
            </Button>
            {showDivider && (
              <div className="relative text-center text-xs text-muted-foreground">
                <span className="bg-card relative z-10 px-2">or</span>
              </div>
            )}
          </>
        ) : null}

        {devLoginAllowed ? (
          <form onSubmit={handleDevSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="dev-email">Dev email</Label>
              <Input
                id="dev-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading !== null}>
              {loading === "dev" ? <Loader2 className="animate-spin" /> : null}
              Sign in (dev)
            </Button>
            <p className="text-xs text-muted-foreground">
              Development-only login. Disabled in production.
            </p>
          </form>
        ) : (
          !googleEnabled && (
            <p className="text-sm text-muted-foreground">
              Google OAuth is not configured yet. Set GOOGLE_CLIENT_ID /
              GOOGLE_CLIENT_SECRET (see GOOGLE_CLOUD_SETUP.md), or enable the
              dev login with AUTH_ALLOW_DEV_LOGIN.
            </p>
          )
        )}
      </CardContent>
    </Card>
  );
}
