/**
 * Personalization variables for email templates.
 *
 * Templates use `{{variable}}` placeholders (e.g. `{{firstName}}`). The set of
 * known variables maps to Lead fields plus a few mail-merge conveniences.
 * Anything not in this set is flagged as unknown during template editing so
 * typos are caught before a campaign goes live.
 */

export interface TemplateVariable {
  name: string;
  label: string;
}

/** Canonical, known variables. Custom lead fields are NOT in this list — they
 * are resolved at send time from `Lead.customFields` but cannot be validated
 * statically, so unknown-name warnings are advisory for those. */
export const TEMPLATE_VARIABLES: readonly TemplateVariable[] = [
  { name: "firstName", label: "First name" },
  { name: "lastName", label: "Last name" },
  { name: "name", label: "Full name" },
  { name: "company", label: "Company" },
  { name: "website", label: "Website" },
  { name: "location", label: "Location" },
  { name: "phone", label: "Phone" },
  { name: "industry", label: "Industry" },
  { name: "jobTitle", label: "Job title" },
  { name: "email", label: "Email" },
  { name: "unsubscribeLink", label: "Unsubscribe link" },
  { name: "senderName", label: "Your name" },
  { name: "senderEmail", label: "Your email" },
] as const;

/** Map of known variable name → canonical name (case-insensitive lookup). */
const KNOWN_BY_LOWER = new Map<string, string>(
  TEMPLATE_VARIABLES.map((v) => [v.name.toLowerCase(), v.name]),
);

const VARIABLE_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

/** Extract the distinct variable names used in a piece of template text. */
export function extractVariables(text: string): string[] {
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  const re = new RegExp(VARIABLE_RE);
  while ((match = re.exec(text)) !== null) {
    found.add(match[1]);
  }
  return [...found];
}

export interface TemplateValidation {
  /** Variables used in the template. */
  variables: string[];
  /** Variables that match a known lead/personalization field (normalized). */
  known: string[];
  /** Variables that do NOT match any known field — likely typos or
   * lead-specific custom fields (which resolve dynamically at send time). */
  unknown: string[];
}

/** Validate subject + body, returning known/unknown variable usage. */
export function validateTemplate(subject: string, body: string): TemplateValidation {
  const variables = extractVariables(`${subject}\n${body}`);
  const known: string[] = [];
  const unknown: string[] = [];
  for (const raw of variables) {
    const canonical = KNOWN_BY_LOWER.get(raw.toLowerCase());
    if (canonical) known.push(canonical);
    else unknown.push(raw);
  }
  return { variables, known, unknown };
}

/** Sample values used for the live preview. */
const SAMPLE_VALUES: Record<string, string> = {
  firstName: "Alex",
  lastName: "Johnson",
  name: "Alex Johnson",
  company: "Acme Corp",
  website: "acme.com",
  location: "San Francisco, CA",
  phone: "+1 (555) 010-2030",
  industry: "SaaS",
  jobTitle: "VP of Growth",
  email: "alex@acme.com",
  unsubscribeLink: "https://app.example.com/unsubscribe",
  senderName: "Jordan",
  senderEmail: "jordan@example.com",
};

/**
 * Replace known variables with sample values so the user can preview their
 * template. Unknown variables are left as-is (they may be custom fields).
 */
export function previewTemplate(text: string): string {
  return text.replace(VARIABLE_RE, (full, raw: string) => {
    const canonical = KNOWN_BY_LOWER.get(String(raw).toLowerCase());
    if (canonical && canonical in SAMPLE_VALUES) {
      return SAMPLE_VALUES[canonical];
    }
    return full;
  });
}
