/**
 * Column → lead field mapping for spreadsheet imports.
 *
 * Keys are the sheet column headers; values are lead field targets:
 *   email | firstName | lastName | name | company | website | location |
 *   phone | industry | jobTitle | tags | custom
 *
 * "tags" splits on commas/semicolons into the Lead.tags array; "custom"
 * stores the value in Lead.customFields under the original header name.
 */

export type FieldTarget =
  | "email"
  | "firstName"
  | "lastName"
  | "name"
  | "company"
  | "website"
  | "location"
  | "phone"
  | "industry"
  | "jobTitle"
  | "tags"
  | "status"
  | "custom";

export type FieldMapping = Record<string, FieldTarget>;

const STANDARD_FIELDS: Exclude<FieldTarget, "tags" | "custom" | "email">[] = [
  "firstName",
  "lastName",
  "name",
  "company",
  "website",
  "location",
  "phone",
  "industry",
  "jobTitle",
  "status",
];

export interface MappedLead {
  email: string;
  data: Record<string, string | null>;
  customFields: Record<string, string>;
  tags: string[];
}

/**
 * Turn one sheet row (Record<header, value>) into the fields we persist.
 * Returns null when the row has no usable email.
 */
export function mapRowToLead(
  row: Record<string, string>,
  mapping: FieldMapping,
): MappedLead | null {
  const emailHeader = Object.keys(mapping).find((h) => mapping[h] === "email");
  const email = emailHeader ? (row[emailHeader] ?? "").trim().toLowerCase() : "";
  if (!email) return null;

  const data: Record<string, string | null> = {};
  const customFields: Record<string, string> = {};
  const tags: string[] = [];

  for (const [header, target] of Object.entries(mapping)) {
    const raw = (row[header] ?? "").trim();
    if (!raw) continue;
    if (target === "email") continue; // handled above
    if (target === "tags") {
      tags.push(
        ...raw
          .split(/[,;]/)
          .map((t) => t.trim())
          .filter(Boolean),
      );
    } else if (target === "custom") {
      customFields[header] = raw;
    } else if ((STANDARD_FIELDS as string[]).includes(target)) {
      data[target] = raw;
    }
  }

  return { email, data, customFields, tags };
}

/** Human-readable label for a field target (used in the mapping UI). */
export const FIELD_TARGET_LABELS: Record<FieldTarget, string> = {
  email: "Email (required)",
  firstName: "First name",
  lastName: "Last name",
  name: "Full name",
  company: "Company",
  website: "Website",
  location: "Location",
  phone: "Phone",
  industry: "Industry",
  jobTitle: "Job title",
  tags: "Tags",
  status: "Status",
  custom: "Custom field",
};

export const FIELD_TARGETS: FieldTarget[] = [
  "email",
  "firstName",
  "lastName",
  "name",
  "company",
  "website",
  "location",
  "phone",
  "industry",
  "jobTitle",
  "tags",
  "status",
  "custom",
];
