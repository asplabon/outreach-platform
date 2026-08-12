"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Braces, Loader2, Save, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  TEMPLATE_TYPES,
  type TemplateType,
} from "@/lib/templates/templates";
import {
  previewTemplate,
  TEMPLATE_VARIABLES,
  validateTemplate,
} from "@/lib/templates/variables";

interface TemplateFormProps {
  /** Existing template id when editing. */
  templateId?: string;
  defaults?: {
    name: string;
    subject: string;
    body: string;
    type: string;
  };
}

export function TemplateForm({ templateId, defaults }: TemplateFormProps) {
  const router = useRouter();
  const [name, setName] = useState(defaults?.name ?? "");
  const [type, setType] = useState<TemplateType>(
    (TEMPLATE_TYPES as readonly string[]).includes(defaults?.type ?? "")
      ? (defaults?.type as TemplateType)
      : "INITIAL",
  );
  const [subject, setSubject] = useState(defaults?.subject ?? "");
  const [body, setBody] = useState(defaults?.body ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validation = useMemo(() => validateTemplate(subject, body), [subject, body]);
  const previewSubject = useMemo(() => previewTemplate(subject), [subject]);
  const previewBody = useMemo(() => previewTemplate(body), [body]);

  async function handleSave() {
    if (!name.trim() || !body.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(templateId ? `/api/templates/${templateId}` : "/api/templates", {
        method: templateId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, subject, body }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save template");
      router.push("/templates");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save template");
      setSaving(false);
    }
  }

  function insertVariable(variable: string) {
    const token = `{{${variable}}}`;
    setBody((prev) => (prev ? `${prev.trimEnd()}\n${token}\n` : token));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <TriangleAlert className="size-4" />
            <AlertTitle>Could not save</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>
              The subject and body support <code>{"{{variable}}"}</code>{" "}
              placeholders that resolve per-lead at send time.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="template-name">Template name</Label>
              <Input
                id="template-name"
                placeholder="e.g. Cold intro — SaaS"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="template-type">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as TemplateType)}>
                <SelectTrigger id="template-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t === "INITIAL" ? "Initial (first touch)" : t === "FOLLOW_UP" ? "Follow-up" : "Manual"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="template-subject">Subject</Label>
              <Input
                id="template-subject"
                placeholder="Hi {{firstName}}, quick question"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="template-body">Body</Label>
              <Textarea
                id="template-body"
                rows={14}
                className="font-mono text-sm leading-relaxed"
                placeholder={"Hi {{firstName}},\n\nI help companies like {{company}}…"}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Braces className="size-4" />
              Variables
            </CardTitle>
            <CardDescription>
              Click to insert a personalization token into the body.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_VARIABLES.map((v) => (
                <button
                  key={v.name}
                  type="button"
                  title={v.label}
                  onClick={() => insertVariable(v.name)}
                  className="hover:bg-muted rounded-md border px-2 py-1 font-mono text-xs transition-colors"
                >
                  {"{{"}{v.name}{"}}"}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {validation.unknown.length > 0 ? (
          <Alert>
            <TriangleAlert className="size-4" />
            <AlertTitle>Unknown variables</AlertTitle>
            <AlertDescription>
              <code>{"{{"}{validation.unknown.join("}} , {{")}{"}}"}</code>{" "}
              doesn&apos;t match a known field. If it&apos;s a custom lead field it
              resolves at send time; otherwise check for typos.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <TriangleAlert className="size-4" />
            <AlertTitle className="flex items-center gap-2">
              <Badge variant="outline">{validation.variables.length} variables</Badge>
              All variables recognized
            </AlertTitle>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Live preview</CardTitle>
            <CardDescription>
              Sample values replace known variables; custom fields stay as tokens.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Subject
              </p>
              <p className="mt-1">{previewSubject || "—"}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Body
              </p>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {previewBody}
              </pre>
            </div>
          </CardContent>
        </Card>

        <Button onClick={() => void handleSave()} disabled={saving || !name.trim() || !body.trim()}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          {templateId ? "Save changes" : "Create template"}
        </Button>
      </div>
    </div>
  );
}
