import { z } from "zod";

/**
 * Central, validated access to environment variables. Throw a clear error at
 * boot if anything required is missing or malformed — better than failing at
 * first use deep inside a worker or route handler.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // Database (SQLite for local dev, PostgreSQL in production — see schema).
  DATABASE_URL: z.string().min(1).default("file:./dev.db"),

  // Queue. Empty REDIS_URL + QUEUE_MODE=in_process runs jobs in-process.
  REDIS_URL: z.string().default(""),
  QUEUE_MODE: z.enum(["auto", "redis", "in_process"]).default("auto"),

  // Auth.
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(8),

  // Google OAuth (app sign-in). Empty until configured — see GOOGLE_CLOUD_SETUP.md.
  GOOGLE_CLIENT_ID: z.string().default(""),
  GOOGLE_CLIENT_SECRET: z.string().default(""),
  // Custom OAuth redirect used by the mailbox (Gmail + Sheets) connection.
  GOOGLE_REDIRECT_URI: z
    .string()
    .url()
    .default("http://localhost:3000/api/google/callback"),

  // AI.
  AI_PROVIDER: z.enum(["demo", "openai"]).default("demo"),
  OPENAI_API_KEY: z.string().default(""),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),

  // Security: AES-256-GCM master key (32 random bytes hex).
  ENCRYPTION_KEY: z.string().min(16),

  // Dev-only login fallback.
  AUTH_ALLOW_DEV_LOGIN: z
    .string()
    .default("false")
    .transform((v) => v === "true" || v === "1"),
  DEV_LOGIN_EMAIL: z.string().default(""),

  // Sending defaults.
  EMAIL_DEFAULT_DAILY_LIMIT: z.coerce.number().int().min(1).default(50),
  REPLY_SYNC_INTERVAL_MINUTES: z.coerce.number().int().min(1).default(5),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env = parsed.data;

/** True when the in-process FIFO queue should be used instead of BullMQ. */
export function isInProcessQueueMode(): boolean {
  return (
    env.QUEUE_MODE === "in_process" ||
    (env.QUEUE_MODE === "auto" && !env.REDIS_URL)
  );
}
