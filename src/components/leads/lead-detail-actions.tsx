"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  type LeadStatus,
} from "@/lib/leads/leads";

interface LeadDetailActionsProps {
  leadId: string;
  status: string;
  tags: string[];
  notes: string | null;
}

export function LeadDetailActions({ leadId, status, tags, notes }: LeadDetailActionsProps) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState<LeadStatus>(
    (LEAD_STATUSES as readonly string[]).includes(status) ? (status as LeadStatus) : "NEW",
  );
  const [tagsInput, setTagsInput] = useState(tags.join(", "));
  const [notesInput, setNotesInput] = useState(notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: currentStatus,
          tags: tagsInput.split(/[,;]/).map((t) => t.trim()).filter(Boolean),
          notes: notesInput,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save changes");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this lead? All outreach history is removed.")) return;
    const res = await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/leads");
      router.refresh();
    } else {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Could not delete lead");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-1.5">
        <Label htmlFor="lead-status">Status</Label>
        <Select value={currentStatus} onValueChange={(v) => setCurrentStatus(v as LeadStatus)}>
          <SelectTrigger id="lead-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEAD_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {LEAD_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="lead-tags">Tags</Label>
        <Input
          id="lead-tags"
          placeholder="founder, warm"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="lead-notes">Notes</Label>
        <Textarea
          id="lead-notes"
          rows={5}
          placeholder="Context for this lead…"
          value={notesInput}
          onChange={(e) => setNotesInput(e.target.value)}
        />
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {saved ? <p className="text-emerald-600 text-sm">Saved.</p> : null}

      <div className="flex gap-2">
        <Button onClick={() => void handleSave()} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          Save changes
        </Button>
        <Button variant="outline" onClick={() => void handleDelete()} className="text-destructive">
          <Trash2 />
          Delete
        </Button>
      </div>
    </div>
  );
}
