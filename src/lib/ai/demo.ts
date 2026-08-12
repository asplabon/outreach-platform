import {
  type AIProvider,
  type ClassifyReplyInput,
  type GenerateReplyInput,
  type GenerateReplyResult,
  type ReplyClassification,
  type ReplyIntent,
} from "@/lib/ai/types";

/**
 * DemoProvider — a deterministic, zero-network implementation of AIProvider.
 *
 * Classifies replies by keyword heuristics and drafts replies from a template.
 * It exists so the whole reply pipeline is exercisable without an OpenAI key,
 * and is clearly labeled "demo" on every AiRun row. It is NOT used when
 * `AI_PROVIDER=openai` (see getAiProvider in provider.ts).
 */

const UNSUBSCRIBE_RE =
  /unsubscribe|remove me|stop sending|opt.?out|no more emails/i;
const PRICING_RE =
  /price|pricing|cost|how much|quote|priced|paid plan|rates?/i;
const MEETING_RE =
  /meeting|call|demo|book|schedule|calendar|available\b|slot/i;
const PRODUCT_RE =
  /product|features?|how does it work|more info|tell me more|details|integration/i;
const NOT_INTERESTED_RE =
  /not interested|no thanks|no thank you|please stop|don'?t contact|wrong (person|company)/i;

function heuristicIntent(subject: string, body: string): {
  intent: ReplyIntent;
  confidence: number;
} {
  const text = `${subject}\n${body}`;
  if (UNSUBSCRIBE_RE.test(text)) return { intent: "UNSUBSCRIBE_REQUEST", confidence: 0.95 };
  if (NOT_INTERESTED_RE.test(text)) return { intent: "NOT_INTERESTED", confidence: 0.85 };
  if (PRICING_RE.test(text)) return { intent: "PRICING_REQUEST", confidence: 0.9 };
  if (MEETING_RE.test(text)) return { intent: "MEETING_REQUEST", confidence: 0.9 };
  if (PRODUCT_RE.test(text)) return { intent: "PRODUCT_INFO", confidence: 0.85 };
  return { intent: "GENERAL", confidence: 0.5 };
}

function shorten(text: string, max: number): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
}

export class DemoProvider implements AIProvider {
  readonly name = "demo";

  async classifyReply(input: ClassifyReplyInput): Promise<ReplyClassification> {
    const { intent, confidence } = heuristicIntent(
      input.replySubject,
      input.replyBody,
    );
    const summary = shorten(
      `Demo classification — looks like a ${intent.replace(/_/g, " ").toLowerCase()} (${input.replySubject || "no subject"})`,
      200,
    );

    const isAutoReplyCandidate =
      intent !== "UNSUBSCRIBE_REQUEST" && intent !== "NOT_INTERESTED";
    const escalation =
      intent === "UNSUBSCRIBE_REQUEST"
        ? "Unsubscribe request — never auto-reply"
        : intent === "NOT_INTERESTED"
          ? "Lead said not interested — requires human review"
          : undefined;

    return { intent, confidence, summary, isAutoReplyCandidate, escalation };
  }

  async generateReply(input: GenerateReplyInput): Promise<GenerateReplyResult> {
    const leadName = input.leadName || "there";
    const companyLine = input.leadCompany
      ? `Happy to walk through how this could help ${input.leadCompany}. `
      : "";
    const context = input.campaignInstructions
      ? `\n\n(Following instructions: ${input.campaignInstructions})`
      : "";

    const draftText = `Hi ${leadName},

Thanks for getting back to me. ${companyLine}What does a good next step look like for you — a quick call, or would you prefer details over email?

Best,
${input.senderName}

[Demo draft — intent: ${input.intent}${context}]`;

    return { draftText };
  }
}
