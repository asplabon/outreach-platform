"use client";

import { useState } from "react";
import { Loader2, Unplug } from "lucide-react";

import { Button } from "@/components/ui/button";

export function DisconnectButton({ connectionId }: { connectionId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDisconnect() {
    if (!window.confirm("Disconnect this Google account? Its mailbox and any connected spreadsheets will be removed.")) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/google/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Failed to disconnect");
      }
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={() => void handleDisconnect()}
        disabled={loading}
      >
        {loading ? <Loader2 className="animate-spin" /> : <Unplug />}
        Disconnect
      </Button>
      {error ? (
        <p className="text-destructive text-xs">{error}</p>
      ) : null}
    </div>
  );
}
