import Link from "next/link";
import { Megaphone } from "lucide-react";

import type { CampaignFunnelRow } from "@/lib/analytics/analytics";
import { percent } from "@/lib/analytics/analytics";

const STAGES = [
  { key: "total", label: "Total", className: "bg-primary/70" },
  { key: "sent", label: "Sent", className: "bg-primary/50" },
  { key: "replied", label: "Replied", className: "bg-chart-2/70" },
  { key: "interested", label: "Interested", className: "bg-chart-3/70" },
] as const;

interface CampaignFunnelProps {
  rows: CampaignFunnelRow[];
}

/** Horizontal funnel bars per campaign: total → sent → replied → interested. */
export function CampaignFunnel({ rows }: CampaignFunnelProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <Megaphone className="text-muted-foreground size-8" />
        <p className="text-sm text-muted-foreground">
          No campaign data yet — launch a campaign to see its funnel.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {rows.map((row) => {
        const max = row.total || 1;
        return (
          <li key={row.campaignId}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <Link
                href={`/campaigns/${row.campaignId}`}
                className="truncate text-sm font-medium hover:underline"
              >
                {row.name}
              </Link>
              <span className="shrink-0 text-xs text-muted-foreground">
                {row.total} leads
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {STAGES.map((stage) => {
                const value = row[stage.key];
                return (
                  <div key={stage.key} className="flex flex-col gap-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${stage.className}`}
                        style={{ width: `${Math.max((value / max) * 100, value > 0 ? 4 : 0)}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {stage.label} · {value} ({percent(value / max)})
                    </span>
                  </div>
                );
              })}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
