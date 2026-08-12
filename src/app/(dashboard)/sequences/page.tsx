import Link from "next/link";
import { ListOrdered, Plus } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { listSequences } from "@/lib/sequences/sequences";
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
import { SequenceDeleteButton } from "@/components/sequences/sequence-delete-button";

export default async function SequencesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const sequences = await listSequences(user.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sequences</h1>
          <p className="text-muted-foreground text-sm">
            Ordered follow-up steps — each lands a set number of days after the
            previous send.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/sequences/new" />}>
          <Plus />
          New sequence
        </Button>
      </div>

      {sequences.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListOrdered className="size-4" />
              No sequences yet
            </CardTitle>
            <CardDescription>
              Build a sequence of follow-up emails and attach it to a campaign.
              Campaigns without a sequence are single-message.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Steps</TableHead>
                  <TableHead>Campaigns</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sequences.map((sequence) => (
                  <TableRow key={sequence.id}>
                    <TableCell>
                      <Link
                        href={`/sequences/${sequence.id}/edit`}
                        className="hover:underline font-medium"
                      >
                        {sequence.name}
                      </Link>
                      {sequence.description ? (
                        <div className="text-muted-foreground text-xs">
                          {sequence.description}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{sequence.steps.length}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {sequence._count.campaigns}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(sequence.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        nativeButton={false}
                        render={<Link href={`/sequences/${sequence.id}/edit`} />}
                      >
                        Edit
                      </Button>
                      <SequenceDeleteButton sequenceId={sequence.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}