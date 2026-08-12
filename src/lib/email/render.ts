import { createHmac } from "crypto";

import { env } from "@/lib/env";
import type { Lead, Mailbox, User } from "@prisma/client";

/**
 * Send-time personalization.
 *
 * Templates use `{{variable}}` placeholders (see lib/templates/variables for
 * the editing/preview side). The editor statically validates the *known* set;
 * at send time we resolve every placeholder against the actual lead and the
 * sender mailbox, including lead-specific custom fields via the dotted form
 * `{{customFields.someField}}`.
 */

// Same grammar as lib/templates/variables (kept local so the send path needs
// no knowledge of the editor).
const VARIABLE_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export interface RenderContext {
  lead: Pick<
    Lead,
    | "id"
    | "firstName"
    | "lastName"
    | "name"
    | "company"
    | "website"
    | "location"
    | "phone"
    | "industry"
    | "jobTitle"
    | "email"
    | "customFields"
  >;
  sender: { name: string; email: string };
  /** Resolved value for the `{{unsubscribeLink}}` variable. */
  unsubscribeUrl: string;
}

export interface RenderedMessage {
  subject: string;
  body: string;
}

/**
 * Resolve a resolved (canonical) variable name to its value for a context.
 * Returns `undefined` when there's no value so unknown/empty variables can be
 * left alone by the caller.
 */
function resolveVariable(
  name: string,
  ctx: RenderContext,
  lead: RenderContext["lead"],
  sender: RenderContext["sender"],
): string | undefined {
  switch (name) {
    case "firstName":
      return lead.firstName ?? "";
    case "lastName":
      return lead.lastName ?? "";
    case "name":
      return (
        lead.name ??
        [lead.firstName, lead.lastName].filter(Boolean).join(" ") ??
        ""
      );
    case "company":
      return lead.company ?? "";
    case "website":
      return lead.website ?? "";
    case "location":
      return lead.location ?? "";
    case "phone":
      return lead.phone ?? "";
    case "industry":
      return lead.industry ?? "";
    case "jobTitle":
      return lead.jobTitle ?? "";
    case "email":
      return lead.email ?? "";
    case "senderName":
      return sender.name;
    case "senderEmail":
      return sender.email;
    case "unsubscribeLink":
      return ctx.unsubscribeUrl;
    default:
      return undefined;
  }
}

/**
 * Render a template's subject and body with personalization applied.
 *
 * - Known variables → replaced with the lead/sender value (empty string if the
 *   lead has no value for that field).
 * - Dotted custom fields (`{{customFields.x}}`) → looked up on the lead's
 *   `customFields` object.
 * - Anything else (likely a typo) → left literally in place so it stays
 *   visible rather than silently becoming blank.
 */
export function renderMessage(
  template: { subject: string; body: string },
  ctx: RenderContext,
): RenderedMessage {
  const lead = ctx.lead;
  const sender = ctx.sender;
  const substitute = (text: string): string =>
    text.replace(VARIABLE_RE, (full, raw: string) => {
      const name = String(raw);
      const lower = name.toLowerCase();

      // Lead-specific custom field, looked up by dot-path. The prefix is
      // matched case-insensitively, but the field key keeps its original case
      // (with a case-insensitive fallback) so `{{customFields.leadScore}}`
      // resolves against a `leadScore` key.
      if (lower.startsWith("customfields.")) {
        const key = name.slice("customFields".length).replace(/^\./, "");
        const custom = lead.customFields as Record<string, unknown> | null;
        const value = lookupCustom(custom, key);
        if (typeof value === "string") return value;
        if (typeof value === "number" || typeof value === "boolean") {
          return String(value);
        }
        return ""; // referenced field has no value on this lead
      }

      // Canonical known variables (case-insensitive lookup).
      const canonical = KNOWN_SWITCH[lower];
      if (canonical) {
        const value = resolveVariable(canonical, ctx, lead, sender);
        return value ?? full;
      }

      // Unknown variable — leave the placeholder intact.
      return full;
    });

  return { subject: substitute(template.subject), body: substitute(template.body) };
}

/** Maps lower-cased canonical variable name → canonical name. */
const KNOWN_SWITCH: Record<string, string> = {
  firstname: "firstName",
  lastname: "lastName",
  name: "name",
  company: "company",
  website: "website",
  location: "location",
  phone: "phone",
  industry: "industry",
  jobtitle: "jobTitle",
  email: "email",
  sendername: "senderName",
  senderemail: "senderEmail",
  unsubscribelink: "unsubscribeLink",
};

/** Look up a custom field value, matching the key as-is then case-insensitively. */
function lookupCustom(
  custom: Record<string, unknown> | null | undefined,
  key: string,
): unknown {
  if (!custom) return undefined;
  if (key in custom) return custom[key];
  const lower = key.toLowerCase();
  for (const [k, v] of Object.entries(custom)) {
    if (k.toLowerCase() === lower) return v;
  }
  return undefined;
}

/** RFC 5322 display name + address, e.g. `Jordan Smith <jordan@example.com>`. */
export function formatSender(sender: { name: string; email: string }): string {
  if (!sender.name) return sender.email;
  // Strip any angle brackets/comma mischief from a user-supplied display name.
  const safe = sender.name.replace(/[<>,]/g, "").trim();
  return safe ? `${safe} <${sender.email}>` : sender.email;
}

/**
 * Build the per-lead unsubscribe URL. HMAC-signed so the lead id can't be
 * forged to opt someone else out. The route that honors it is served in a
 * later phase; templates may reference `{{unsubscribeLink}}` from today.
 */
export function buildUnsubscribeUrl(leadId: string): string {
  const base = env.NEXTAUTH_URL ?? "http://localhost:3000";
  const sig = createHmac("sha256", env.ENCRYPTION_KEY)
    .update(leadId)
    .digest("hex")
    .slice(0, 16);
  const params = new URLSearchParams({ lead: leadId, sig });
  return `${base}/api/unsubscribe?${params.toString()}`;
}

/** Convenience: build a full render context for a send. */
export function buildRenderContext(
  lead: RenderContext["lead"],
  sender: Pick<Mailbox, "emailAddress">,
  user: Pick<User, "name" | "email"> | null,
): RenderContext {
  const senderName =
    user?.name ??
    (user?.email ?? sender.emailAddress).split("@")[0] ??
    sender.emailAddress;
  return {
    lead,
    sender: { name: senderName, email: sender.emailAddress },
    unsubscribeUrl: buildUnsubscribeUrl(lead.id ?? ""),
  };
}