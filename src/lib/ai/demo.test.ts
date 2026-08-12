import { describe, expect, it } from "vitest";

import { DemoProvider } from "@/lib/ai/demo";
import { ClassificationSchema, type ClassifyReplyInput, type GenerateReplyInput } from "@/lib/ai/types";

const demo = new DemoProvider();

function input(overrides: Partial<ClassifyReplyInput> = {}): ClassifyReplyInput {
  return {
    replySubject: "Re: Intro",
    replyBody: "Hello",
    leadName: "Jane Doe",
    leadCompany: "Acme Inc",
    campaignName: "Q3 launch",
    campaignInstructions: "",
    ...overrides,
  };
}

function genInput(overrides: Partial<GenerateReplyInput> = {}): GenerateReplyInput {
  return {
    originalSubject: "Intro — Acme Inc",
    originalBody: "Hi Jane, ...",
    replySubject: "Re: Intro — Acme Inc",
    replyBody: "What does it cost?",
    leadName: "Jane Doe",
    leadCompany: "Acme Inc",
    senderName: "Sam",
    intent: "PRICING_REQUEST",
    confidence: 0.9,
    campaignInstructions: "",
    replyMode: "APPROVAL",
    ...overrides,
  };
}

describe("DemoProvider.classifyReply", () => {
  it("detects unsubscribe requests and never marks them auto-reply candidates", async () => {
    const result = await demo.classifyReply(
      input({ replyBody: "Please unsubscribe me from these emails." }),
    );
    expect(result.intent).toBe("UNSUBSCRIBE_REQUEST");
    expect(result.isAutoReplyCandidate).toBe(false);
    expect(result.escalation).toBeTruthy();
  });

  it("detects not-interested and escalates", async () => {
    const result = await demo.classifyReply(input({ replyBody: "Not interested, thanks." }));
    expect(result.intent).toBe("NOT_INTERESTED");
    expect(result.isAutoReplyCandidate).toBe(false);
    expect(result.escalation).toBeTruthy();
  });

  it("detects pricing requests", async () => {
    const result = await demo.classifyReply(input({ replyBody: "How much does it cost?" }));
    expect(result.intent).toBe("PRICING_REQUEST");
    expect(result.isAutoReplyCandidate).toBe(true);
  });

  it("detects meeting requests", async () => {
    const result = await demo.classifyReply(input({ replyBody: "Sure, let's book a call." }));
    expect(result.intent).toBe("MEETING_REQUEST");
    expect(result.isAutoReplyCandidate).toBe(true);
  });

  it("detects product info requests", async () => {
    const result = await demo.classifyReply(
      input({ replyBody: "Can you share more details on the features?" }),
    );
    expect(result.intent).toBe("PRODUCT_INFO");
    expect(result.isAutoReplyCandidate).toBe(true);
  });

  it("falls back to GENERAL with low confidence on ambiguous replies", async () => {
    const result = await demo.classifyReply(input({ replyBody: "Thanks, I'll think about it." }));
    expect(result.intent).toBe("GENERAL");
    expect(result.confidence).toBeLessThan(0.7);
    expect(result.isAutoReplyCandidate).toBe(true);
  });

  it("returns output that satisfies ClassificationSchema (every field type-checks)", async () => {
    const result = await demo.classifyReply(input({ replyBody: "Tell me about pricing." }));
    const parsed = ClassificationSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });
});

describe("DemoProvider.generateReply", () => {
  it("returns a labeled draft mentioning the lead and company", async () => {
    const result = await demo.generateReply(genInput());
    expect(result.draftText).toContain("Jane Doe");
    expect(result.draftText).toContain("Acme Inc");
    expect(result.draftText).toContain("[Demo draft — intent: PRICING_REQUEST]");
  });

  it("omits the company line when no company is known", async () => {
    const result = await demo.generateReply(genInput({ leadCompany: null }));
    expect(result.draftText).not.toContain("Acme Inc");
  });

  it("falls back to 'there' when no lead name is known", async () => {
    const result = await demo.generateReply(genInput({ leadName: "" }));
    expect(result.draftText).toContain("Hi there,");
  });

  it("echoes campaign instructions into the draft label", async () => {
    const result = await demo.generateReply(
      genInput({ campaignInstructions: "Keep it short, no pricing." }),
    );
    expect(result.draftText).toContain("Following instructions: Keep it short, no pricing.");
  });
});
