import IORedis from "ioredis";

import { env } from "@/lib/env";

let connection: IORedis | null = null;

/**
 * Shared Redis connection for BullMQ queues and workers.
 * `maxRetriesPerRequest: null` is required by BullMQ workers.
 */
export function getRedisConnection(): IORedis {
  if (!env.REDIS_URL) {
    throw new Error("REDIS_URL is not set — cannot use Redis queue mode");
  }
  if (!connection) {
    connection = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
  }
  return connection;
}
