"use client";

import { useState } from "react";
import { Loader2, Plus, FileSpreadsheet, CheckCircle2, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FIELD_TARGETS,
  FIELD_TARGET_LABELS,
  type FieldMapping,
  type FieldTarget,
} from "@/lib/leads/mapping";

interface SheetTab {
  sheetId: number;
  title: string;
  gridRows: number;
  gridCols: number;
}

interface AddedSpreadsheet {
  id: string;
  spreadsheetId: string;
  title: string;
  url: string;
  tabs: SheetTab[];
}

interface ImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
}

interface SheetsConnectProps {
  googleConfigured: boolean;
  hasConnection: boolean;
}

/** Guess sensible default targets from common header names. */
function guessMapping(headers: string[]): FieldMapping {
  const mapping: FieldMapping = {};
  for (const header of headers) {
    const h = header.toLowerCase();
    if (/e\s*m\s*a\s*i\s*l|@|email/.test(h)) mapping[header] = "email";
    else if (/first.*name|firstname/.test(h)) mapping[header] = "firstName";
    else if (/last.*name|lastname/.test(h)) mapping[header] = "lastName";
    else if (/^name$/.test(h)) mapping[header] = "name";
    else if (/compan|organiz|account/.test(h)) mapping[header] = "company";
    else if (/website|web|url|site/.test(h)) mapping[header] = "website";
    else if (/location|city|state|country/.test(h)) mapping[header] = "location";
    else if (/phone|mobile|tel/.test(h)) mapping[header] = "phone";
    else if (/industr/.test(h)) mapping[header] = "industry";
    else if (/title|job/.test(h)) mapping[header] = "jobTitle";
    else mapping[header] = "custom";
  }
  return mapping;
}

export function SheetsConnect({ googleConfigured, hasConnection }: SheetsConnectProps) {
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [loadingHeaders, setLoadingHeaders] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const [spreadsheet, setSpreadsheet] = useState<AddedSpreadsheet | null>(null);
  const [tab, setTab] = useState<string>("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<FieldMapping>({});

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setAdding(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/sheets/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json()) as { spreadsheet?: AddedSpreadsheet; error?: string };
      if (!res.ok || !data.spreadsheet) throw new Error(data.error ?? "Failed to add spreadsheet");
      setSpreadsheet(data.spreadsheet);
      if (data.spreadsheet.tabs.length > 0) setTab(data.spreadsheet.tabs[0].title);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add spreadsheet");
    } finally {
      setAdding(false);
    }
  }

  async function handleTabChange(next: string) {
    setTab(next);
    setHeaders([]);
    setPreview([]);
    setResult(null);
    if (!spreadsheet) return;
    setLoadingHeaders(true);
    setError(null);
    try {
      const res = await fetch("/api/sheets/tabs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spreadsheetId: spreadsheet.id, sheetName: next }),
      });
      const data = (await res.json()) as {
        headers?: string[];
        preview?: Record<string, string>[];
        error?: string;
      };
      if (!res.ok || !data.headers) throw new Error(data.error ?? "Could not read tab");
      setHeaders(data.headers);
      setPreview(data.preview ?? []);
      setMapping(guessMapping(data.headers));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read tab");
    } finally {
      setLoadingHeaders(false);
    }
  }

  async function handleImport() {
    if (!spreadsheet || !tab || !Object.values(mapping).includes("email")) return;
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/sheets/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spreadsheetId: spreadsheet.id, sheetName: tab, fieldMapping: mapping }),
      });
      const data = (await res.json()) as ImportResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  const hasEmailMapping = Object.values(mapping).includes("email");

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="destructive">
          <TriangleAlert className="size-4" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {result ? (
        <Alert>
          <CheckCircle2 className="size-4" />
          <AlertTitle>Import complete</AlertTitle>
          <AlertDescription>
            {result.created} created · {result.updated} updated · {result.skipped}{" "}
            skipped (no email) · {result.total} rows total
          </AlertDescription>
        </Alert>
      ) : null}

      {!googleConfigured ? (
        <Alert variant="destructive">
          <TriangleAlert className="size-4" />
          <AlertTitle>Google OAuth is not configured</AlertTitle>
          <AlertDescription>
            Set <code>GOOGLE_CLIENT_ID</code> / <code>GOOGLE_CLIENT_SECRET</code>{" "}
            in .env and restart, then connect a mailbox first.
          </AlertDescription>
        </Alert>
      ) : !hasConnection ? (
        <Alert>
          <TriangleAlert className="size-4" />
          <AlertTitle>Connect a mailbox first</AlertTitle>
          <AlertDescription>
            You need an authorized Google account before connecting a
            spreadsheet. Use the “Connect Gmail” button on the Mailboxes page.
          </AlertDescription>
        </Alert>
      ) : null}

      {!spreadsheet ? (
        <Card>
          <CardHeader>
            <CardTitle>Add a lead spreadsheet</CardTitle>
            <CardDescription>
              Paste the Google Sheets URL. The sheet&apos;s first row must be column
              headers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="grid flex-1 gap-1.5">
                <Label htmlFor="sheet-url">Spreadsheet URL</Label>
                <Input
                  id="sheet-url"
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={adding}>
                {adding ? <Loader2 className="animate-spin" /> : <Plus />}
                Add spreadsheet
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="size-4" />
                {spreadsheet.title}
              </CardTitle>
              <CardDescription>
                Pick the tab that contains your leads.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="grid flex-1 gap-1.5">
                <Label htmlFor="sheet-tab">Tab</Label>
                <Select value={tab} onValueChange={(v) => handleTabChange(String(v))}>
                  <SelectTrigger id="sheet-tab" className="w-full">
                    <SelectValue placeholder="Choose a tab" />
                  </SelectTrigger>
                  <SelectContent>
                    {spreadsheet.tabs.map((t) => (
                      <SelectItem key={t.sheetId} value={t.title}>
                        {t.title}
                        <span className="text-muted-foreground text-xs">
                          {t.gridRows} rows × {t.gridCols} cols
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleTabChange(tab)}
                disabled={!tab || loadingHeaders}
              >
                {loadingHeaders ? <Loader2 className="animate-spin" /> : null}
                Load headers
              </Button>
            </CardContent>
          </Card>

          {headers.length > 0 ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Map columns</CardTitle>
                  <CardDescription>
                    Choose which spreadsheet column feeds each lead field. Map at
                    least one column to Email. Columns mapped to “Custom field”
                    are stored on the lead&apos;s customFields.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!hasEmailMapping ? (
                    <p className="text-destructive mb-3 text-sm">
                      Map at least one column to Email to import.
                    </p>
                  ) : null}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-1/2">Sheet column</TableHead>
                        <TableHead>Lead field</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {headers.map((header) => (
                        <TableRow key={header}>
                          <TableCell className="font-medium">{header}</TableCell>
                          <TableCell>
                            <Select
                              value={mapping[header]}
                              onValueChange={(v) =>
                                setMapping((prev) => ({
                                  ...prev,
                                  [header]: v as FieldTarget,
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {FIELD_TARGETS.map((target) => (
                                  <SelectItem key={target} value={target}>
                                    {FIELD_TARGET_LABELS[target]}
                                    {target === "email" ? (
                                      <Badge variant="outline">required</Badge>
                                    ) : null}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {preview.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Preview</CardTitle>
                    <CardDescription>First {preview.length} data rows.</CardDescription>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {headers.map((h) => (
                            <TableHead key={h}>{h}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.map((row, i) => (
                          <TableRow key={i}>
                            {headers.map((h) => (
                              <TableCell key={h}>{row[h] ?? "—"}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ) : null}

              <Button
                onClick={() => void handleImport()}
                disabled={importing || !hasEmailMapping}
              >
                {importing ? <Loader2 className="animate-spin" /> : null}
                Import leads
              </Button>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
