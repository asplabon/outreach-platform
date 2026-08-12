import { describe, it, expect } from "vitest";

import { renderMessage, formatSender, buildUnsubscribeUrl } from "./render";

function ctx(overrides?: Record<string, unknown>) {
  return {
    lead: {
      id: "lead1",
      firstName: "Alex",
      lastName: "Johnson",
      name: null as string | null,
      company: "Acme Corp",
      website: "acme.com",
      location: "San Francisco, CA",
      phone: "+1 555-0100",
      industry: "SaaS",
      jobTitle: "VP Growth",
      email: "alex@acme.com",
      customFields: { leadScore: 87, segment: "enterprise" },
    },
    sender: { name: "Jordan", email: "jordan@example.com" },
    unsubscribeUrl: "https://app.example.com/unsubscribe?lead=lead1&sig=abc",
    ...overrides,
  };
}

describe("renderMessage", () => {
  it("fills known lead variables", () => {
    const { body } = renderMessage(
      { subject: "Hi {{firstName}}", body: "Hi {{firstName}} at {{company}} ({{jobTitle}})" },
      ctx(),
    );
    expect(body).toBe("Hi Alex at Acme Corp (VP Growth)");
  });

  it("falls back to full name for {{name}}", () => {
    const { subject } = renderMessage({ subject: "{{name}}", body: "x" }, ctx());
    expect(subject).toBe("Alex Johnson");
  });

  it("uses sender variables", () => {
    const { body } = renderMessage(
      { subject: "x", body: "From {{senderName}} <{{senderEmail}}>" },
      ctx(),
    );
    expect(body).toBe("From Jordan <jordan@example.com>");
  });

  it("resolves dotted customFields", () => {
    const { body } = renderMessage(
      { subject: "x", body: "score={{customFields.leadScore}} seg={{customFields.segment}}" },
      ctx(),
    );
    expect(body).toBe("score=87 seg=enterprise");
  });

  it("leaves unknown variables intact", () => {
    const { body } = renderMessage({ subject: "x", body: "Hi {{notARealVar}}" }, ctx());
    expect(body).toBe("Hi {{notARealVar}}");
  });

  it("resolves the unsubscribe link", () => {
    const { body } = renderMessage(
      { subject: "x", body: "Unsubscribe: {{unsubscribeLink}}" },
      ctx(),
    );
    expect(body).toBe("Unsubscribe: https://app.example.com/unsubscribe?lead=lead1&sig=abc");
  });

  it("normalizes variable casing", () => {
    const { subject } = renderMessage(
      { subject: "{{FIRSTNAME}} {{CUSTOMFIELDS.leadScore}}", body: "x" },
      ctx(),
    );
    expect(subject).toBe("Alex 87");
  });

  it("treats missing lead values as empty strings", () => {
    const { body } = renderMessage(
      { subject: "x", body: "{{phone}}|{{website}}" },
      ctx({ lead: { ...ctx().lead, phone: null as string | null, website: null as string | null } }),
    );
    expect(body).toBe("|");
  });
});

describe("formatSender", () => {
  it("formats name + email", () => {
    expect(formatSender({ name: "Jordan", email: "j@example.com" })).toBe("Jordan <j@example.com>");
  });

  it("omits an empty name", () => {
    expect(formatSender({ name: "", email: "j@example.com" })).toBe("j@example.com");
  });

  it("strips dangerous characters from a display name", () => {
    expect(formatSender({ name: "Bob <evil>,x", email: "j@example.com" })).toBe(
      "Bob evilx <j@example.com>",
    );
  });
});

describe("buildUnsubscribeUrl", () => {
  it("is deterministic and signed", () => {
    const a = buildUnsubscribeUrl("lead1");
    const b = buildUnsubscribeUrl("lead1");
    expect(a).toBe(b);
    expect(a).toContain("sig=");
    expect(a).not.toBe(buildUnsubscribeUrl("lead2"));
  });
});