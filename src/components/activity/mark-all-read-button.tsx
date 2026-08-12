"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export function MarkAllReadButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function markAll() {
    setBusy(true);
    try {
      await fetch("/api/notifications/read", { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={() => void markAll()} disabled={busy}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}
      Mark all read
    </Button>
  );
}
