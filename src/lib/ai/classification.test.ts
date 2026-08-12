import { describe, expect, it } from "vitest";

import {
  AUTO_REPLY_MIN_CONFIDENCE,
  ClassificationSchema,
  DEFAULT_AUTO_REPLY_INTENTS,
  REPLY_INTENTS,
  type ReplyClassification,
  type ReplyIntent,
} from "@/lib/ai/types";
import { decideSendRoute } from "@/lib/ai/replies";

const valid: ReplyClassification = {
  intent: "PRICING_REQUEST",
  confidence: 0.9,
  summary: "Lead asks about pricing.",
  isAutoReplyCandidate: true,
};

describe("ClassificationSchema", () => {
  it("accepts a valid classification", () => {
    const parsed = ClassificationSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("rejects an unknown intent", () => {
    const parsed = ClassificationSchema.safeParse({
      ...valid,
      intent: "SLS_REPLY_OBVIOUS",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects confidence out of range", () => {
    expect(ClassificationSchema.safeParse({ ...valid, confidence: 1.4 }).success).toBe(false);
    expect(ClassificationSchema.safeParse({ ...valid, confidence: -0.1 }).success).toBe(false);
  });

  it("rejects a missing required field", () => {
    const missing: Omit<ReplyClassification, "summary"> = {
      intent: "PRICING_REQUEST",
      confidence: 0.9,
      isAutoReplyCandidate: true,
    };
    expect(ClassificationSchema.safeParse(missing).success).toBe(false);
  });

  it("allows escalation to be absent and rejects it when too long", () => {
    expect(ClassificationSchema.safeParse(valid).success).toBe(true);
    const parsed = ClassificationSchema.safeParse({
      ...valid,
      escalation: "x".repeat(200),
    });
    expect(parsed.success).toBe(false);
  });

  it("round-trips every enum member", () => {
    for (const intent of REPLY_INTENTS) {
      const parsed = ClassificationSchema.safeParse({ ...valid, intent });
      expect(parsed.success).toBe(true);
      if (parsed.success) expect(parsed.data.intent).toBe(intent);
    }
  });
});

describe("decideSendRoute (escalation rules)", () => {
  const base = {
    replyMode: "APPROVAL" as const,
    allowedIntents: DEFAULT_AUTO_REPLY_INTENTS,
    confidence: 0.95,
  };

  it("pending review in APPROVAL mode even for a good candidate", () => {
    const route = decideSendRoute({
      ...base,
      isAutoReplyCandidate: true,
      escalation: null,
      intent: "PRICING_REQUEST",
    });
    expect(route.status).toBe("PENDING_REVIEW");
    expect(route.escalation).toBeNull();
  });

  it("auto-sends in AUTO mode for an allowed intent above the confidence floor", () => {
    const route = decideSendRoute({
      ...base,
      replyMode: "AUTO",
      isAutoReplyCandidate: true,
      escalation: null,
      intent: "MEETING_REQUEST",
    });
    expect(route.status).toBe("SENT");
  });

  it("never auto-sends an intent outside the campaign's allow-list", () => {
    const route = decideSendRoute({
      ...base,
      replyMode: "AUTO",
      isAutoReplyCandidate: true,
      escalation: null,
      intent: "SUPPORT_QUESTION",
    });
    expect(route.status).toBe("PENDING_REVIEW");
  });

  it("never auto-sends below the confidence floor", () => {
    const route = decideSendRoute({
      ...base,
      replyMode: "AUTO",
      isAutoReplyCandidate: true,
      escalation: null,
      intent: "PRICING_REQUEST",
      confidence: AUTO_REPLY_MIN_CONFIDENCE - 0.05,
    });
    expect(route.status).toBe("PENDING_REVIEW");
  });

  it("escalates when the model flags a non-candidate (unsubscribe / not interested)", () => {
    const route = decideSendRoute({
      ...base,
      replyMode: "AUTO",
      isAutoReplyCandidate: false,
      escalation: "Lead said not interested — requires human review",
      intent: "NOT_INTERESTED",
    });
    expect(route.status).toBe("ESCALATED");
    expect(route.escalation).toContain("not interested");
  });

  it("escalates on a model escalation even when the intent is auto-allowed", () => {
    const route = decideSendRoute({
      ...base,
      replyMode: "AUTO",
      isAutoReplyCandidate: true,
      escalation: "Unusually aggressive language",
      intent: "PRICING_REQUEST",
    });
    expect(route.status).toBe("ESCALATED");
  });

  it("requires a human when a non-candidate arrives without a reason string", () => {
    const route = decideSendRoute({
      ...base,
      replyMode: "AUTO",
      isAutoReplyCandidate: false,
      escalation: null,
      intent: "GENERAL" as ReplyIntent,
    });
    expect(route.status).toBe("ESCALATED");
    expect(route.escalation).toBe("Blocked from auto-reply — requires review");
  });
});
