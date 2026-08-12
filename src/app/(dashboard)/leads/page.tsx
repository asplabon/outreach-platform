import Link from "next/link";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import {
  getLeadTags,
  getLeads,
  LEAD_STATUS_LABELS,
  type LeadSortKey,
} from "@/lib/leads/leads";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LeadsToolbar } from "@/components/leads/leads-toolbar";
import { LeadAddDialog } from "@/components/leads/lead-add-dialog";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const sort = (sp.sort as LeadSortKey) || "createdAt";
  const dir = sp.dir === "asc" ? "asc" : "desc";
  const [tags, result] = await Promise.all([
    getLeadTags(user.id),
    getLeads(user.id, {
      q: sp.q,
      status: sp.status,
      tag: sp.tag,
      sort,
      dir,
      page,
    }),
  ]);

  const { leads, total, totalPages } = result;
  const paginate = (target: number) =>
    new URLSearchParams({ ...sp, page: String(Math.min(totalPages, Math.max(1, target))) }).toString();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-muted-foreground text-sm">
            {total} lead{total === 1 ? "" : "s"} — imported or added manually.
          </p>
        </div>
        <LeadAddDialog />
      </div>

      <LeadsToolbar tags={tags} />

      {leads.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4" />
              No leads
            </CardTitle>
            <CardDescription>
              Connect a spreadsheet on the Sheets page and import leads, or add
              one manually.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <Link href={`/leads/${lead.id}`} className="hover:underline">
                        <span className="font-medium">
                          {lead.name || lead.firstName || lead.email}
                        </span>
                      </Link>
                      <div className="text-muted-foreground text-xs">{lead.email}</div>
                    </TableCell>
                    <TableCell className="text-sm">{lead.company || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(lead.tags as string[]).slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                        {(lead.tags as string[]).length > 3 ? (
                          <Badge variant="outline">
                            +{(lead.tags as string[]).length - 3}
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={lead.status === "NEW" ? "outline" : "default"}>
                        {LEAD_STATUS_LABELS[lead.status as keyof typeof LEAD_STATUS_LABELS] ?? lead.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(lead.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              nativeButton={false} render={<Link href={`/leads?${paginate(page - 1)}`} />}
            >
              <ChevronLeft />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              nativeButton={false} render={<Link href={`/leads?${paginate(page + 1)}`} />}
            >
              Next
              <ChevronRight />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
