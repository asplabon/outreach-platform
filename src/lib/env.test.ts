import { describe, expect, it } from "vitest";
import { vi } from "vitest";

import { env, isInProcessQueueMode } from "@/lib/env";

describe("env", () => {
  it("parses valid variables from the test environment", () => {
    expect(env.NEXTAUTH_SECRET).toBe("vitest-secret-0123456789");
    expect(env.ENCRYPTION_KEY.length).toBeGreaterThanOrEqual(16);
    expect(env.AI_PROVIDER).toBe("demo");
    expect(env.AUTH_ALLOW_DEV_LOGIN).toBe(true); // transformed to boolean
    expect(env.DEV_LOGIN_EMAIL).toBe("test@example.com");
    expect(env.EMAIL_DEFAULT_DAILY_LIMIT).toBe(50); // coerced to number
    expect(env.REPLY_SYNC_INTERVAL_MINUTES).toBe(5);
  });

  it("detects in-process queue mode when REDIS_URL is empty", () => {
    expect(env.REDIS_URL).toBe("");
    expect(env.QUEUE_MODE).toBe("in_process");
    expect(isInProcessQueueMode()).toBe(true);
  });

  it("throws when a required variable is missing", async () => {
    const backup = process.env.NEXTAUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;

    vi.resetModules();
    await expect(import("@/lib/env")).rejects.toThrow(/NEXTAUTH_SECRET/);

    process.env.NEXTAUTH_SECRET = backup;
  });
});
