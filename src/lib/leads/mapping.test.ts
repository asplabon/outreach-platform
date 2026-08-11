import { describe, expect, it } from "vitest";

import { mapRowToLead, type FieldMapping } from "@/lib/leads/mapping";

describe("mapRowToLead", () => {
  const mapping: FieldMapping = {
    Email: "email",
    "First Name": "firstName",
    Company: "company",
    Tags: "tags",
    Region: "custom",
    Status: "status",
  };

  it("maps standard fields and normalizes email", () => {
    const lead = mapRowToLead(
      {
        Email: "  JANE@Example.com ",
        "First Name": "Jane",
        Company: "Acme Inc",
      },
      mapping,
    );
    expect(lead).toEqual({
      email: "jane@example.com",
      data: { firstName: "Jane", company: "Acme Inc" },
      customFields: {},
      tags: [],
    });
  });

  it("returns null when there is no email column value", () => {
    const lead = mapRowToLead(
      { Email: "", "First Name": "Jane", Company: "Acme" },
      mapping,
    );
    expect(lead).toBeNull();
  });

  it("returns null when email is not mapped", () => {
    const lead = mapRowToLead(
      { "First Name": "Jane" },
      { "First Name": "firstName" },
    );
    expect(lead).toBeNull();
  });

  it("splits tags on commas and semicolons", () => {
    const lead = mapRowToLead(
      { Email: "a@b.com", Tags: "Founder, SaaS; Cold" },
      mapping,
    );
    expect(lead?.tags).toEqual(["Founder", "SaaS", "Cold"]);
  });

  it("stores custom-field values under the original header", () => {
    const lead = mapRowToLead(
      { Email: "a@b.com", Region: "EU" },
      mapping,
    );
    expect(lead?.customFields).toEqual({ Region: "EU" });
  });

  it("maps status into the lead data", () => {
    const lead = mapRowToLead(
      { Email: "a@b.com", Status: "MEETING" },
      mapping,
    );
    expect(lead?.data.status).toBe("MEETING");
  });

  it("skips empty cells entirely", () => {
    const lead = mapRowToLead(
      { Email: "a@b.com", Company: "  ", "First Name": "Bob" },
      mapping,
    );
    expect(lead?.data).toEqual({ firstName: "Bob" });
  });
});
