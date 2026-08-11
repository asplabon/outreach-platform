import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in — Outreach Platform",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
