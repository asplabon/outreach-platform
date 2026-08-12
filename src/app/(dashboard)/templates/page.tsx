import Link from "next/link";
import { FileText, Plus } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { listTemplates } from "@/lib/templates/templates";
import { extractVariables } from "@/lib/templates/variables";
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
import { TemplateDeleteButton } from "@/components/templates/template-delete-button";

export default async function TemplatesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const templates = await listTemplates(user.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
          <p className="text-muted-foreground text-sm">
            Reusable emails with <code>{"{{variable}}"}</code> personalization.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/templates/new" />}>
          <Plus />
          New template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4" />
              No templates yet
            </CardTitle>
            <CardDescription>
              Create your first template — a subject and body with{" "}
              <code>{"{{firstName}}"}</code> and <code>{"{{company}}"}</code>{" "}
              placeholders that personalize each send.
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
                  <TableHead>Type</TableHead>
                  <TableHead>Variables</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => {
                  const vars = extractVariables(`${template.subject}\n${template.body}`);
                  return (
                    <TableRow key={template.id}>
                      <TableCell>
                        <Link
                          href={`/templates/${template.id}/edit`}
                          className="hover:underline font-medium"
                        >
                          {template.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{template.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">
                          {vars.length > 0
                            ? vars.slice(0, 4).map((v) => `{{${v}}}`).join(" ") +
                              (vars.length > 4 ? ` +${vars.length - 4}` : "")
                            : "None"}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(template.updatedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          nativeButton={false} render={<Link href={`/templates/${template.id}/edit`} />}
                        >
                          Edit
                        </Button>
                        <TemplateDeleteButton templateId={template.id} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
