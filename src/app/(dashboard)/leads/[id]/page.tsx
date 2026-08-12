import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Megaphone, Users } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { LEAD_STATUS_LABELS } from "@/lib/leads/leads";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LeadDetailActions } from "@/components/leads/lead-detail-actions";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { id } = await params;

  const lead = await prisma.lead.findFirst({
    where: { id, userId: user.id },
    include: {
      campaignLeads: {
        include: { campaign: { select: { id: true, name: true, status: true } } },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });
  if (!lead) notFound();

  const initials = (lead.name || lead.firstName || lead.email)
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const profile: { label: string; value: string }[] = [
    { label: "First name", value: lead.firstName ?? "—" },
    { label: "Last name", value: lead.lastName ?? "—" },
    { label: "Company", value: lead.company ?? "—" },
    { label: "Job title", value: lead.jobTitle ?? "—" },
    { label: "Website", value: lead.website ?? "—" },
    { label: "Location", value: lead.location ?? "—" },
    { label: "Phone", value: lead.phone ?? "—" },
    { label: "Industry", value: lead.industry ?? "—" },
  ];
  const customFields = lead.customFields as Record<string, string>;
  const tags = lead.tags as string[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="size-14 rounded-full">
            <AvatarFallback className="rounded-full text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {lead.name || lead.firstName || lead.email}
            </h1>
            <p className="text-muted-foreground text-sm">
              {lead.email} ·{" "}
              <Badge variant={lead.status === "NEW" ? "outline" : "default"}>
                {LEAD_STATUS_LABELS[lead.status as keyof typeof LEAD_STATUS_LABELS] ?? lead.status}
              </Badge>
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <Button nativeButton={false} render={<Link href="/leads" />} variant="outline">
          Back to leads
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Added {formatDate(lead.createdAt)}.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 sm:grid-cols-2">
                {profile.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                  >
                    <dt className="text-muted-foreground text-sm">{row.label}</dt>
                    <dd className="text-sm font-medium">{row.value}</dd>
                  </div>
                ))}
              </dl>
              {Object.keys(customFields).length > 0 ? (
                <div className="mt-4">
                  <p className="text-muted-foreground mb-2 text-sm font-medium">
                    Custom fields
                  </p>
                  <dl className="grid gap-3 sm:grid-cols-2">
                    {Object.entries(customFields).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                      >
                        <dt className="text-muted-foreground text-sm">{key}</dt>
                        <dd className="text-sm font-medium">{value || "—"}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Megaphone className="size-4" />
                Campaigns
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lead.campaignLeads.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Not in any campaign yet. Create a campaign and import leads to
                  reach them.
                </p>
              ) : (
                <ul className="space-y-2">
                  {lead.campaignLeads.map((cl) => (
                    <li
                      key={cl.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2"
                    >
                      <Link
                        href={`/campaigns/${cl.campaignId}`}
                        className="hover:underline text-sm font-medium"
                      >
                        {cl.campaign.name}
                      </Link>
                      <Badge variant="outline">{cl.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="size-4" />
                Recent messages
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lead.messages.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No messages yet — sending arrives with Phase 4.
                </p>
              ) : (
                <ul className="space-y-2">
                  {lead.messages.map((message) => (
                    <li
                      key={message.id}
                      className="rounded-md border px-3 py-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {message.subject || "(no subject)"}
                        </span>
                        <Badge variant="outline">{message.status}</Badge>
                      </div>
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                        {message.body ?? ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4" />
              Manage
            </CardTitle>
            <CardDescription>Status, tags and notes.</CardDescription>
          </CardHeader>
          <CardContent>
            <LeadDetailActions
              leadId={lead.id}
              status={lead.status}
              tags={tags}
              notes={lead.notes}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
