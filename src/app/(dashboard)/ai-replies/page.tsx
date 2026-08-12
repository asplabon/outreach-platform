import { Bot, CheckCircle2, Inbox, TriangleAlert } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { REPLY_INTENT_LABELS } from "@/lib/ai/types";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AiReplyActions } from "@/components/ai-replies/ai-reply-actions";

const STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: "Pending review",
  ESCALATED: "Escalated",
  SENT: "Sent",
  REJECTED: "Rejected",
};

export default async function AiRepliesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const drafts = await prisma.aiReply.findMany({
    where: { lead: { userId: user.id } },
    include: {
      lead: { select: { name: true, firstName: true, email: true, company: true } },
      reply: { select: { subject: true, body: true, receivedAt: true } },
      campaign: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const actionable = drafts.filter(
    (d) => d.status === "PENDING_REVIEW" || d.status === "ESCALATED",
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI Replies</h1>
        <p className="text-muted-foreground text-sm">
          Drafts the AI wrote for inbound replies. Approve to send in-thread,
          reject to discard. Auto mode sends allowed intents directly.
        </p>
      </div>

      {drafts.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Inbox className="size-4" />
              No AI replies yet
            </CardTitle>
            <CardDescription>
              When a lead replies, the AI classifies the message and drafts a
              response here. Runs on the demo provider until you set
              AI_PROVIDER=openai.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {actionable.length > 0 ? (
            <div className="flex items-center gap-2 text-sm text-amber-600">
              <TriangleAlert className="size-4" />
              {actionable.length} draft{actionable.length === 1 ? "" : "s"} need
              your review
            </div>
          ) : null}
          {drafts.map((draft) => {
            const leadName =
              draft.lead.name ?? draft.lead.firstName ?? draft.lead.email;
            const intent = draft.intent ? (draft.intent as string) : null;
            const canAct =
              draft.status === "PENDING_REVIEW" || draft.status === "ESCALATED";
            return (
              <Card key={draft.id}>
                <CardHeader className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                      <span>{leadName}</span>
                      {draft.lead.company ? (
                        <span className="text-muted-foreground text-sm font-normal">
                          · {draft.lead.company}
                        </span>
                      ) : null}
                    </CardTitle>
                    <CardDescription>
                      {draft.lead.email}
                      {draft.campaign?.name ? ` · ${draft.campaign.name}` : ""}
                      {draft.reply?.receivedAt
                        ? ` · replied ${formatDate(draft.reply.receivedAt)}`
                        : ""}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {intent ? (
                      <Badge variant="secondary">
                        {REPLY_INTENT_LABELS[intent as keyof typeof REPLY_INTENT_LABELS] ??
                          intent}
                      </Badge>
                    ) : null}
                    {draft.confidence != null ? (
                      <Badge variant="outline">
                        {Math.round(draft.confidence * 100)}% confident
                      </Badge>
                    ) : null}
                    <Badge
                      variant={
                        draft.status === "SENT"
                          ? "default"
                          : draft.status === "ESCALATED"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {STATUS_LABELS[draft.status] ?? draft.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {draft.escalation ? (
                    <p className="flex items-center gap-1.5 text-xs text-destructive">
                      <TriangleAlert className="size-3.5 shrink-0" />
                      {draft.escalation}
                    </p>
                  ) : null}
                  {draft.reply?.subject || draft.reply?.body ? (
                    <div className="rounded-md border bg-muted/30 p-3 text-sm">
                      <p className="font-medium">
                        {draft.reply.subject || "(no subject)"}
                      </p>
                      {draft.reply.body ? (
                        <p className="text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap">
                          {draft.reply.body}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="rounded-md border p-3 text-sm whitespace-pre-wrap">
                    {draft.draftText}
                  </div>
                  {canAct ? (
                    <AiReplyActions
                      aiReplyId={draft.id}
                      status={draft.status}
                      leadName={leadName}
                    />
                  ) : draft.status === "SENT" ? (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CheckCircle2 className="size-3.5" />
                      Sent automatically or by you.
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <Bot className="size-3.5" />
        Powered by the configured AI provider (demo by default; set
        AI_PROVIDER=openai for real classification and drafting).
      </div>
    </div>
  );
}
