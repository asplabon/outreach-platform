import { env } from "@/lib/env";
import { type AIProvider } from "@/lib/ai/types";
import { DemoProvider } from "@/lib/ai/demo";

let cached: AIProvider | null = null;

/**
 * The active AI provider, selected by `AI_PROVIDER=demo|openai`.
 *
 * The OpenAI provider is imported lazily and never instantiated unless it is
 * actually configured, so the demo (default) keeps the SDK out of the hot
 * path. The resolved provider is cached for the process lifetime.
 */
export async function getAiProvider(): Promise<AIProvider> {
  if (cached) return cached;
  if (env.AI_PROVIDER === "openai") {
    const { OpenAIProvider } = await import("@/lib/ai/openai");
    cached = new OpenAIProvider();
  } else {
    cached = new DemoProvider();
  }
  return cached;
}
