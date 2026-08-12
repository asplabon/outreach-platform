import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * BullMQ 6 references the optional Valkey Glide client for a connection
   * mode we don't use (we use ioredis). The reference is a runtime require()
   * wrapped in try/catch, so BullMQ falls back to Redis when the module is
   * absent. Without this, the server bundle tries to resolve the package and
   * fails the build. Marking it external keeps the build green and lets the
   * runtime catch handle the missing module.
   *
   * The OpenAI SDK is loaded lazily by the AI provider (src/lib/ai) and only
   * used when AI_PROVIDER=openai; keeping it external avoids bundling it into
   * server chunks for demo-mode installs.
   */
  serverExternalPackages: ["@valkey/valkey-glide", "openai"],
};

export default nextConfig;
