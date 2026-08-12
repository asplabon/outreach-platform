"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

interface CsvExportButtonProps {
  /** Downloaded filename, e.g. "campaigns.csv". */
  filename: string;
  /** Pre-serialized CSV content (server-side via toCsv). */
  csv: string;
  label?: string;
}

/** Downloads the given CSV as a file from the browser. */
export function CsvExportButton({ filename, csv, label = "Export CSV" }: CsvExportButtonProps) {
  const [busy, setBusy] = useState(false);

  function download() {
    setBusy(true);
    try {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={download}
      disabled={busy || !csv}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      {label}
    </Button>
  );
}
