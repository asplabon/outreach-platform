import type { LucideIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PlaceholderPageProps {
  title: string;
  description: string;
  icon: LucideIcon;
  phase?: string;
  planned: string[];
}

/**
 * Empty-state shell for sections that land in a later build phase.
 * Renders honest "not implemented yet" content — no fabricated data.
 */
export function PlaceholderPage({
  title,
  description,
  icon: Icon,
  phase,
  planned,
}: PlaceholderPageProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {phase ? <Badge variant="secondary">{phase}</Badge> : null}
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
              <Icon className="text-muted-foreground size-5" />
            </div>
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This section is under construction and will be implemented in{" "}
            {phase ?? "a later phase"}. Nothing here is fabricated — the
            feature ships complete with real integration when its phase lands.
          </p>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Planned
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {planned.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
