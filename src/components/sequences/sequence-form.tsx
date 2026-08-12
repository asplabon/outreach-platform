"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, Loader2, Plus, Save, Trash2 } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StepDraft {
  delayDays: number;
  templateId: string | null;
  subject: string;
  body: string;
}

interface SequenceFormProps {
  sequenceId?: string;
  defaults?: {
    name: string;
    description: string | null;
    steps: StepDraft[];
  };
  templates: { id: string; label: string }[];
}

export function SequenceForm({ sequenceId, defaults, templates }: SequenceFormProps) {
  const router = useRouter();
  const [name, setName] = useState(defaults?.name ?? "");
  const [description, setDescription] = useState(defaults?.description ?? "");
  const [steps, setSteps] = useState<StepDraft[]>(
    defaults?.steps?.length
      ? defaults.steps
      : [{ delayDays: 3, templateId: null, subject: "", body: "" }],
  );
  const [saving, setSaving] = useState(false);

  function updateStep(index: number, patch: Partial<StepDraft>) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function addStep() {
    setSteps((prev) => [
      ...prev,
      { delayDays: 3, templateId: null, subject: "", body: "" },
    ]);
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      window.alert("Give the sequence a name.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name,
        description: description.trim() ? description : null,
        steps: steps.map((s) => ({
          delayDays: s.delayDays,
          templateId: s.templateId || null,
          subject: s.subject.trim() ? s.subject : null,
          body: s.body.trim() ? s.body : null,
        })),
      };
      const res = await fetch(sequenceId ? `/api/sequences/${sequenceId}` : "/api/sequences", {
        method: sequenceId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string; id?: string };
      if (!res.ok) {
        window.alert(data.error ?? "Could not save sequence");
        return;
      }
      router.push("/sequences");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Basics</CardTitle>
          <CardDescription>Name the sequence so campaigns can reference it.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="sequence-name">Name</Label>
            <Input
              id="sequence-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 3-touch founder follow-up"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sequence-description">Description</Label>
            <Input
              id="sequence-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional — what this sequence is for"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Follow-up steps
            <Button type="button" variant="outline" size="sm" onClick={addStep}>
              <Plus />
              Add step
            </Button>
          </CardTitle>
          <CardDescription>
            Steps send in order. The campaign&apos;s initial template is step 0, so a
            step here is the {steps.length === 1 ? "first" : "nth"} follow-up.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {steps.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No follow-ups yet — add a step to send more than one message.
            </p>
          ) : (
            steps.map((step, index) => (
              <div key={index} className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Follow-up {index + 1}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeStep(index)}
                    disabled={steps.length === 1}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                    <span className="sr-only">Remove step</span>
                  </Button>
                </div>
                <div className="mt-3 grid gap-3">
                  <div className="grid gap-2">
                    <Label>Send after</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        className="w-28"
                        value={step.delayDays}
                        onChange={(e) =>
                          updateStep(index, { delayDays: Math.max(0, Number(e.target.value)) })
                        }
                      />
                      <span className="text-muted-foreground text-sm">
                        {step.delayDays === 1 ? "day" : "days"} of silence
                      </span>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Template</Label>
                    <Select
                      value={step.templateId ?? "none"}
                      onValueChange={(v) => updateStep(index, { templateId: v === "none" ? null : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pick a template" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No template — write inline below</SelectItem>
                        {templates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Subject (inline fallback)</Label>
                    <Input
                      value={step.subject}
                      onChange={(e) => updateStep(index, { subject: e.target.value })}
                      placeholder="Re: {{company}}"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Body (inline fallback)</Label>
                    <Textarea
                      rows={3}
                      value={step.body}
                      onChange={(e) => updateStep(index, { body: e.target.value })}
                      placeholder="Hi {{firstName}} — bumping this to the top of your inbox…"
                    />
                  </div>
                </div>
              </div>
            ))
          )}
          {steps.length > 1 ? (
            <div className="flex items-center gap-1 text-muted-foreground">
              <ArrowDown className="size-4" />
              <span className="text-xs">Steps send in order, each after the previous one</span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save sequence
        </Button>
      </div>
    </form>
  );
}