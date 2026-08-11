import path from "node:path";
import { defineConfig } from "vitest/config";

const dirname = import.meta.dirname;

/**
 * Vitest configuration.
 *
 * `test.env` seeds process.env so modules that validate the environment at
 * import time (src/lib/env.ts) work under test. Keep this in sync with
 * .env.example.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "file:./test.db",
      REDIS_URL: "",
      QUEUE_MODE: "in_process",
      NEXTAUTH_URL: "http://localhost:3000",
      NEXTAUTH_SECRET: "vitest-secret-0123456789",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      GOOGLE_REDIRECT_URI: "http://localhost:3000/api/google/callback",
      AI_PROVIDER: "demo",
      OPENAI_API_KEY: "",
      OPENAI_MODEL: "gpt-4o-mini",
      ENCRYPTION_KEY: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
      AUTH_ALLOW_DEV_LOGIN: "true",
      DEV_LOGIN_EMAIL: "test@example.com",
      EMAIL_DEFAULT_DAILY_LIMIT: "50",
      REPLY_SYNC_INTERVAL_MINUTES: "5",
    },
  },
});
