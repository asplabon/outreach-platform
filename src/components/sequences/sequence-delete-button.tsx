"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export function SequenceDeleteButton({ sequenceId }: { sequenceId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm("Delete this sequence? Its steps are removed too.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/sequences/${sequenceId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        window.alert(data.error ?? "Could not delete sequence");
        return;
      }
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => void handleDelete()}
      disabled={deleting}
      className="text-muted-foreground hover:text-destructive"
    >
      {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      <span className="sr-only">Delete sequence</span>
    </Button>
  );
}