"use client";

import { useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
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
  type LeadSortKey,
} from "@/lib/leads/leads";

interface LeadsToolbarProps {
  tags: string[];
}

const SORT_OPTIONS: { value: LeadSortKey; label: string }[] = [
  { value: "createdAt", label: "Created" },
  { value: "name", label: "Name" },
  { value: "email", label: "Email" },
  { value: "status", label: "Status" },
  { value: "lastContactedAt", label: "Last contacted" },
];

/** Build a new URL preserving unrelated params. */
function updateParams(params: URLSearchParams, patch: Record<string, string | null>): string {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
  }
  next.set("page", "1"); // any filter change resets pagination
  const q = next.toString();
  return q ? `?${q}` : "";
}

export function LeadsToolbar({ tags }: LeadsToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "";
  const tag = params.get("tag") ?? "";
  const sort = params.get("sort") ?? "";
  const dir = params.get("dir") ?? "";
  const searchTimeout = useRef<number | null>(null);

  const go = (patch: Record<string, string | null>) =>
    router.push(pathname + updateParams(params, patch));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-52 flex-1">
        <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          className="pl-8"
          placeholder="Search name, email, company…"
          defaultValue={q}
          onChange={(e) => {
            // Debounce so typing doesn't spam navigation.
            const value = e.target.value;
            if (searchTimeout.current) window.clearTimeout(searchTimeout.current);
            searchTimeout.current = window.setTimeout(() => go({ q: value }), 350);
          }}
        />
      </div>

      <Select
        value={status || "all"}
        onValueChange={(v) => go({ status: v === "all" ? null : v })}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {LEAD_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {LEAD_STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {tags.length > 0 ? (
        <Select value={tag || "all"} onValueChange={(v) => go({ tag: v === "all" ? null : v })}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tags</SelectItem>
            {tags.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      <Select
        value={`${sort || "createdAt"}:${dir || "desc"}`}
        onValueChange={(v) => {
          if (!v) return;
          const [nextSort, nextDir] = v.split(":") as [LeadSortKey, "asc" | "desc"];
          go({ sort: nextSort, dir: nextDir });
        }}
      >
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={`${option.value}:asc`}>
              {option.label} ↑
            </SelectItem>
          ))}
          {SORT_OPTIONS.map((option) => (
            <SelectItem key={`${option.value}:desc`} value={`${option.value}:desc`}>
              {option.label} ↓
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
