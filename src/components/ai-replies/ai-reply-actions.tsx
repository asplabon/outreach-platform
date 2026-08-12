"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";

interface AiReplyActionsProps {
  aiReplyId: string;
  status: string;
  leadName: string;
}

/** Approve sends the AI draft to the lead in-thread; reject discards it. */
export function AiReplyActions({ aiReplyId, status, leadName }: AiReplyActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  async function run(action: "approve" | "reject") {
    setBusy(action);
    try {
      const res = await fetch(`/api/ai-replies/${aiReplyId}/${action}`, {
        method: "POST",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        window.alert(data.error ?? `Could not ${action} draft`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  function confirmReject() {
    const ok = window.confirm(
      `Reject this draft for ${leadName}? The draft is discarded and the reply is marked ignored.`,
    );
    if (ok) void run("reject");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        onClick={() => void run("approve")}
        disabled={busy !== null}
      >
        {busy === "approve" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Check className="size-4" />
        )}
        Approve &amp; send
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={confirmReject}
        disabled={busy !== null}
      >
        {busy === "reject" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <X className="size-4" />
        )}
        Reject
      </Button>
      {status === "ESCALATED" ? (
        <span className="text-xs text-muted-foreground">
          Escalated — review carefully before sending.
        </span>
      ) : null}
    </div>
  );
}
