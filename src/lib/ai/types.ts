import { z } from "zod";

/**
 * AI reply classification & drafting contracts (Phase 6).
 *
 * Every model output is validated with Zod before it is trusted: a malformed
 * provider response never reaches the database. The OpenAI provider asks for
 * strict JSON and we re-validate; the demo provider produces deterministic
 * output that must still pass the same schema.
 */

export const REPLY_INTENTS = [
  "PRICING_REQUEST",
  "MEETING_REQUEST",
  "PRODUCT_INFO",
  "SUPPORT_QUESTION",
  "NOT_INTERESTED",
  "UNSUBSCRIBE_REQUEST",
  "GENERAL",
] as const;

export type ReplyIntent = (typeof REPLY_INTENTS)[number];

export const REPLY_INTENT_LABELS: Record<ReplyIntent, string> = {
  PRICING_REQUEST: "Pricing request",
  MEETING_REQUEST: "Meeting request",
  PRODUCT_INFO: "Product info",
  SUPPORT_QUESTION: "Support question",
  NOT_INTERESTED: "Not interested",
  UNSUBSCRIBE_REQUEST: "Unsubscribe request",
  GENERAL: "General",
};

/** Intents a campaign may allow to auto-reply (defaults to these). */
export const DEFAULT_AUTO_REPLY_INTENTS: ReplyIntent[] = [
  "PRICING_REQUEST",
  "MEETING_REQUEST",
  "PRODUCT_INFO",
  "GENERAL",
];

/** Below this confidence a draft is never sent without a human. */
export const AUTO_REPLY_MIN_CONFIDENCE = 0.7;

/**
 * A classified inbound reply. The provider must produce exactly this shape
 * (as JSON from OpenAI, or deterministically from the demo provider).
 */
export const ClassificationSchema = z.object({
  intent: z.enum(REPLY_INTENTS),
  /** 0..1 — how sure the model is about the intent. */
  confidence: z.number().min(0).max(1),
  /** One-line plain-English summary, for the review UI. */
  summary: z.string().max(200),
  /**
   * Whether this reply is a good auto-reply candidate at all. False for
   * unsubscribe / not-interested / ambiguous noise.
   */
  isAutoReplyCandidate: z.boolean(),
  /** Reason a human must review this even in AUTO mode (empty = none). */
  escalation: z.string().max(120).optional(),
});

export type ReplyClassification = z.infer<typeof ClassificationSchema>;

export interface ClassifyReplyInput {
  replySubject: string;
  replyBody: string;
  leadName: string;
  leadCompany: string | null;
  campaignName: string;
  /** Campaign AI instructions — constrains how the model treats the reply. */
  campaignInstructions: string;
}

export interface GenerateReplyInput {
  /** The outreach message the lead is replying to (context). */
  originalSubject: string;
  originalBody: string;
  replySubject: string;
  replyBody: string;
  leadName: string;
  leadCompany: string | null;
  /** Our (sender) display name. */
  senderName: string;
  intent: ReplyIntent;
  confidence: number;
  campaignInstructions: string;
  replyMode: "APPROVAL" | "AUTO";
}

export interface GenerateReplyResult {
  /** The draft reply body (subject is derived: "Re: <lead's subject>"). */
  draftText: string;
}

/** A provider of AI classification + drafting. */
export interface AIProvider {
  /** Provider name recorded on AiRun rows ("openai" | "demo"). */
  readonly name: string;
  classifyReply(input: ClassifyReplyInput): Promise<ReplyClassification>;
  generateReply(input: GenerateReplyInput): Promise<GenerateReplyResult>;
}
