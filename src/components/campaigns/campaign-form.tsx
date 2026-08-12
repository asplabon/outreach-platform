"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AUTO_REPLY_INTENTS,
  REPLY_MODES,
  type ReplyMode,
} from "@/lib/campaigns/campaigns";

interface Option {
  id: string;
  label: string;
  hint?: string;
}

interface CampaignFormProps {
  campaignId?: string;
  defaults?: {
    name: string;
    description: string | null;
    mailboxId: string | null;
    spreadsheetId: string | null;
    initialTemplateId: string | null;
    dailySendLimit: number;
    timezone: string;
    workingHoursStart: string;
    workingHoursEnd: string;
    sendDelayMin: number;
    sendDelayMax: number;
    replyMode: string;
    autoReplyIntents: string[];
    stopOnReply: boolean;
    aiInstructions: string;
  };
  mailboxes: Option[];
  spreadsheets: Option[];
  templates: Option[];
}

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const;

export function CampaignForm({
  campaignId,
  defaults,
  mailboxes,
  spreadsheets,
  templates,
}: CampaignFormProps) {
  const router = useRouter();
  const [name, setName] = useState(defaults?.name ?? "");
  const [description, setDescription] = useState(defaults?.description ?? "");
  const [mailboxId, setMailboxId] = useState(defaults?.mailboxId ?? "");
  const [spreadsheetId, setSpreadsheetId] = useState(defaults?.spreadsheetId ?? "");
  const [templateId, setTemplateId] = useState(defaults?.initialTemplateId ?? "");
  const [dailySendLimit, setDailySendLimit] = useState(String(defaults?.dailySendLimit ?? 50));
  const [timezone, setTimezone] = useState(defaults?.timezone ?? "UTC");
  const [hoursStart, setHoursStart] = useState(defaults?.workingHoursStart ?? "09:00");
  const [hoursEnd, setHoursEnd] = useState(defaults?.workingHoursEnd ?? "18:00");
  const [delayMin, setDelayMin] = useState(String(defaults?.sendDelayMin ?? 60));
  const [delayMax, setDelayMax] = useState(String(defaults?.sendDelayMax ?? 120));
  const [replyMode, setReplyMode] = useState<ReplyMode>(
    (REPLY_MODES as readonly string[]).includes(defaults?.replyMode ?? "")
      ? (defaults?.replyMode as ReplyMode)
      : "APPROVAL",
  );
  const [autoReplyIntents, setAutoReplyIntents] = useState<string[]>(
    defaults?.autoReplyIntents ?? [],
  );
  const [stopOnReply, setStopOnReply] = useState(defaults?.stopOnReply ?? true);
  const [aiInstructions, setAiInstructions] = useState(defaults?.aiInstructions ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleIntent(intent: string) {
    setAutoReplyIntents((prev) =>
      prev.includes(intent) ? prev.filter((i) => i !== intent) : [...prev, intent],
    );
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(campaignId ? `/api/campaigns/${campaignId}` : "/api/campaigns", {
        method: campaignId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          mailboxId: mailboxId || null,
          spreadsheetId: spreadsheetId || null,
          initialTemplateId: templateId || null,
          dailySendLimit: Number(dailySendLimit) || 50,
          timezone,
          workingHoursStart: hoursStart,
          workingHoursEnd: hoursEnd,
          sendDelayMin: Number(delayMin) || 0,
          sendDelayMax: Number(delayMax) || 0,
          replyMode,
          autoReplyIntents,
          stopOnReply,
          aiInstructions,
        }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save campaign");
      router.push(`/campaigns/${campaignId ?? data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save campaign");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <Alert variant="destructive">
          <TriangleAlert className="size-4" />
          <AlertTitle>Could not save</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Basics</CardTitle>
          <CardDescription>What this campaign is and where it sends from.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="campaign-name">Campaign name</Label>
            <Input
              id="campaign-name"
              placeholder="e.g. Q3 SaaS cold outreach"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="campaign-description">Description</Label>
            <Textarea
              id="campaign-description"
              rows={2}
              placeholder="What's the goal?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sources</CardTitle>
          <CardDescription>Sender mailbox, lead spreadsheet and first-touch template.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="campaign-mailbox">Sending mailbox</Label>
            <Select value={mailboxId} onValueChange={(v) => setMailboxId(v ?? "")}>
              <SelectTrigger id="campaign-mailbox">
                <SelectValue placeholder={mailboxes.length ? "Choose a mailbox" : "No mailboxes connected"} />
              </SelectTrigger>
              <SelectContent>
                {mailboxes.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="campaign-spreadsheet">Lead source</Label>
            <Select value={spreadsheetId} onValueChange={(v) => setSpreadsheetId(v ?? "")}>
              <SelectTrigger id="campaign-spreadsheet">
                <SelectValue placeholder={spreadsheets.length ? "Choose a spreadsheet" : "No spreadsheets connected"} />
              </SelectTrigger>
              <SelectContent>
                {spreadsheets.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="campaign-template">Initial template</Label>
            <Select value={templateId} onValueChange={(v) => setTemplateId(v ?? "")}>
              <SelectTrigger id="campaign-template">
                <SelectValue placeholder={templates.length ? "Choose a template" : "No templates yet"} />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pacing</CardTitle>
          <CardDescription>Volume and timing — the sending worker respects these.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="campaign-limit">Daily send limit</Label>
              <Input
                id="campaign-limit"
                type="number"
                min={1}
                value={dailySendLimit}
                onChange={(e) => setDailySendLimit(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="campaign-delay-min">Delay min (s)</Label>
              <Input
                id="campaign-delay-min"
                type="number"
                min={0}
                value={delayMin}
                onChange={(e) => setDelayMin(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="campaign-delay-max">Delay max (s)</Label>
              <Input
                id="campaign-delay-max"
                type="number"
                min={0}
                value={delayMax}
                onChange={(e) => setDelayMax(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="campaign-timezone">Timezone</Label>
            <Select value={timezone} onValueChange={(v) => setTimezone(v ?? "UTC")}>
              <SelectTrigger id="campaign-timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="campaign-hours-start">Working hours start</Label>
              <Input
                id="campaign-hours-start"
                type="time"
                value={hoursStart}
                onChange={(e) => setHoursStart(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="campaign-hours-end">Working hours end</Label>
              <Input
                id="campaign-hours-end"
                type="time"
                value={hoursEnd}
                onChange={(e) => setHoursEnd(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Replies & AI</CardTitle>
          <CardDescription>
            How the campaign handles inbound replies (used by the Phase 5/6 reply workers).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="campaign-reply-mode">Reply mode</Label>
            <Select value={replyMode} onValueChange={(v) => setReplyMode(v as ReplyMode)}>
              <SelectTrigger id="campaign-reply-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="APPROVAL">
                  Approval — AI drafts replies, you approve
                </SelectItem>
                <SelectItem value="AUTO">
                  Auto — AI replies directly to allowed intents
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <span className="text-sm font-medium">Auto-reply intents (Auto mode only)</span>
            <div className="flex flex-wrap gap-2">
              {AUTO_REPLY_INTENTS.map((intent) => (
                <label
                  key={intent}
                  className="hover:bg-muted flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={autoReplyIntents.includes(intent)}
                    onChange={() => toggleIntent(intent)}
                    className="size-4 accent-foreground"
                  />
                  {intent.replace(/_/g, " ")}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label>Stop on reply</Label>
              <p className="text-muted-foreground text-xs">
                Pause the sequence for a lead once they reply.
              </p>
            </div>
            <Switch checked={stopOnReply} onCheckedChange={setStopOnReply} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="campaign-ai-instructions">AI instructions</Label>
            <Textarea
              id="campaign-ai-instructions"
              rows={3}
              placeholder="e.g. Keep replies under 80 words, always propose a meeting…"
              value={aiInstructions}
              onChange={(e) => setAiInstructions(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div>
        <Button onClick={() => void handleSave()} disabled={saving || !name.trim()}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          {campaignId ? "Save changes" : "Create campaign"}
        </Button>
      </div>
    </div>
  );
}
