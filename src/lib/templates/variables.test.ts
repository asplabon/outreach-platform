import { describe, expect, it } from "vitest";

import {
  extractVariables,
  previewTemplate,
  validateTemplate,
} from "@/lib/templates/variables";

describe("extractVariables", () => {
  it("finds simple variables", () => {
    expect(extractVariables("Hi {{firstName}}, at {{company}}")).toEqual([
      "firstName",
      "company",
    ]);
  });

  it("handles whitespace inside braces", () => {
    expect(extractVariables("{{ firstName }}")).toEqual(["firstName"]);
  });

  it("dedupes repeated variables", () => {
    expect(extractVariables("{{name}} {{name}} {{name}}")).toEqual(["name"]);
  });

  it("supports dots for nested keys", () => {
    expect(extractVariables("{{customFields.industry}}")).toEqual([
      "customFields.industry",
    ]);
  });

  it("returns empty for plain text", () => {
    expect(extractVariables("no variables here")).toEqual([]);
  });
});

describe("validateTemplate", () => {
  it("classifies known variables", () => {
    const res = validateTemplate("Hi {{FirstName}}", "About {{company}}");
    expect(res.known).toContain("firstName");
    expect(res.known).toContain("company");
    expect(res.unknown).toEqual([]);
  });

  it("flags unknown variables as typos", () => {
    const res = validateTemplate("Hi {{firstNmae}}", "");
    expect(res.unknown).toEqual(["firstNmae"]);
  });

  it("treats custom-field vars as unknown but preserved", () => {
    const res = validateTemplate("{{customFields.industry}}", "");
    expect(res.unknown).toEqual(["customFields.industry"]);
  });

  it("combines subject and body", () => {
    const res = validateTemplate("{{firstName}}", "{{company}}");
    expect(res.variables).toEqual(expect.arrayContaining(["firstName", "company"]));
  });
});

describe("previewTemplate", () => {
  it("replaces known variables with sample values", () => {
    expect(previewTemplate("Hi {{firstName}} at {{company}}!")).toBe(
      "Hi Alex at Acme Corp!",
    );
  });

  it("normalizes case-insensitive variables", () => {
    expect(previewTemplate("{{FIRSTNAME}}")).toBe("Alex");
  });

  it("leaves unknown variables untouched", () => {
    expect(previewTemplate("{{typo}} still there")).toBe("{{typo}} still there");
  });
});
