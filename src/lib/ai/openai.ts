import { env } from "@/lib/env";
import {
  ClassificationSchema,
  REPLY_INTENTS,
  type AIProvider,
  type ClassifyReplyInput,
  type GenerateReplyInput,
  type GenerateReplyResult,
  type ReplyClassification,
} from "@/lib/ai/types";

/**
 * OpenAIProvider — real AI classification + drafting via the OpenAI
 * chat-completions API (works with any OpenAI-compatible endpoint).
 *
 * The SDK is imported lazily so that when `AI_PROVIDER=demo` (the default) the
 * web/worker bundle never pulls in the heavy package. Every response is parsed
 * with `ClassificationSchema` and rejected if it does not validate.
 */

type ChatCompletionMessage = {
  role: "system" | "user";
  content: string;
};

function jsonPrompt(
  instruction: string,
  schemaHint: string,
): ChatCompletionMessage[] {
  return [
    {
      role: "system",
      content:
        "You are the reply engine of a cold-email outreach platform. Respond " +
        "with strict JSON only — no markdown, no prose outside the JSON object. " +
        schemaHint,
    },
    { role: "user", content: instruction },
  ];
}

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";

  private async client() {
    const { OpenAI } = await import("openai");
    return new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }

  async classifyReply(input: ClassifyReplyInput): Promise<ReplyClassification> {
    const instruction = [
      "Classify the inbound reply below.",
      `Intents: ${REPLY_INTENTS.join(", ")}.`,
      "Return JSON:",
      `{"intent": one of the intents above, "confidence": 0..1, "summary": "one sentence", "isAutoReplyCandidate": true|false, "escalation": "short reason to escalate to a human, or empty string"}`,
      "",
      `Campaign: ${input.campaignName}`,
      `Campaign instructions: ${input.campaignInstructions || "(none)"}`,
      `Lead: ${input.leadName}${input.leadCompany ? ` (${input.leadCompany})` : ""}`,
      `Reply subject: ${input.replySubject || "(none)"}`,
      "Reply body:",
      input.replyBody || "(empty)",
    ].join("\n");

    const completion = await this.chat(jsonPrompt(instruction,
      "Schema: {\"intent\": string, \"confidence\": number, \"summary\": string, \"isAutoReplyCandidate\": boolean, \"escalation\": string}"));
    const parsed = ClassificationSchema.safeParse(parseJson(completion));
    if (!parsed.success) {
      throw new Error(
        `OpenAI classifyReply returned invalid JSON: ${parsed.error.message}`,
      );
    }
    return parsed.data;
  }

  async generateReply(input: GenerateReplyInput): Promise<GenerateReplyResult> {
    const instruction = [
      "Write a reply (plain text, no subject line, no 'Hi,' signature block) to the inbound reply below.",
      `Campaign instructions to respect: ${input.campaignInstructions || "(none)"}`,
      `Classified intent: ${input.intent} (confidence ${input.confidence})`,
      `Reply mode: ${input.replyMode}`,
      "",
      "Original outreach:",
      `Subject: ${input.originalSubject || "(none)"}`,
      input.originalBody || "(none)",
      "",
      "Inbound reply:",
      `Subject: ${input.replySubject || "(none)"}`,
      input.replyBody || "(empty)",
      "",
      `Our sender: ${input.senderName} · Lead: ${input.leadName}${input.leadCompany ? ` (${input.leadCompany})` : ""}`,
      "",
      "Return JSON: {\"draftText\": \"the reply body\"}.",
    ].join("\n");

    const completion = await this.chat(jsonPrompt(instruction,
      "Schema: {\"draftText\": string}"));
    const parsed = (parseJson(completion) ?? {}) as { draftText?: unknown };
    if (typeof parsed.draftText !== "string" || !parsed.draftText.trim()) {
      throw new Error("OpenAI generateReply returned no usable draftText");
    }
    return { draftText: parsed.draftText.trim() };
  }

  /** Single chat-completions call; throws on API/transport errors. */
  private async chat(messages: ChatCompletionMessage[]): Promise<string> {
    if (!env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set — AI_PROVIDER=openai cannot run");
    }
    const client = await this.client();
    const completion = await client.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages,
      temperature: 0.2,
      response_format: { type: "json_object" },
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned an empty completion");
    return content;
  }
}

function parseJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    // Some endpoints wrap the JSON in ```json fences; strip them.
    const fenced = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    try {
      return JSON.parse(fenced);
    } catch {
      throw new Error(`Provider returned non-JSON: ${content.slice(0, 200)}`);
    }
  }
}
