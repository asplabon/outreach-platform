import { Queue as BullQueue } from "bullmq";

import { getRedisConnection } from "@/lib/queue/connection";
import { isInProcessQueueMode } from "@/lib/env";
import { getProcessor } from "@/lib/queue/processors";

export const QUEUE_NAMES = {
  email: "email",
  reply: "reply",
  sheetSync: "sheet-sync",
  ai: "ai",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface QueueJobOptions {
  /** Enqueue the job after this many milliseconds. */
  delayMs?: number;
  /** Number of attempts (default 3). */
  attempts?: number;
  /** Exponential backoff base delay in ms (default 5000). */
  backoffMs?: number;
  /**
   * Deterministic job id — BullMQ will not enqueue a second job with the same
   * id while the first is still retained, giving us queue-level idempotency.
   */
  jobId?: string;
}

const bullQueues = new Map<QueueName, BullQueue>();

function getBullQueue(name: QueueName): BullQueue {
  let queue = bullQueues.get(name);
  if (!queue) {
    queue = new BullQueue(name, { connection: getRedisConnection() });
    bullQueues.set(name, queue);
  }
  return queue;
}

export interface QueueJob<T = unknown> {
  jobId: string;
  name: string;
  data: T;
}

export type QueueHandler<T = unknown> = (
  job: QueueJob<T>,
) => Promise<void> | void;

/**
 * Enqueue a job on the given queue.
 *
 * - Redis mode: adds a BullMQ job consumed by a worker process.
 * - In-process mode (no Redis): runs the registered handler directly, honoring
 *   `delayMs` via a timer. Used for local development / zero-setup runs.
 */
export async function enqueue<T>(
  queueName: QueueName,
  jobName: string,
  data: T,
  options: QueueJobOptions = {},
): Promise<string | undefined> {
  if (isInProcessQueueMode()) {
    return runInProcess(queueName, jobName, data, options);
  }
  const job = await getBullQueue(queueName).add(jobName, data as object, {
    jobId: options.jobId,
    delay: options.delayMs,
    attempts: options.attempts ?? 3,
    backoff: options.backoffMs
      ? { type: "exponential", delay: options.backoffMs }
      : { type: "exponential", delay: 5000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  });
  return job.id;
}

async function runInProcess<T>(
  queueName: QueueName,
  jobName: string,
  data: T,
  options: QueueJobOptions,
): Promise<string | undefined> {
  const handler = getProcessor(queueName, jobName);
  if (!handler) {
    console.warn(
      `[queue] no handler registered for "${queueName}:${jobName}" — job dropped`,
    );
    return undefined;
  }
  const jobId = options.jobId ?? crypto.randomUUID();
  const run = async () => {
    try {
      await handler({ jobId, name: jobName, data });
    } catch (error) {
      console.error(`[queue] job ${queueName}:${jobName} (${jobId}) failed:`, error);
    }
  };
  if (options.delayMs) {
    setTimeout(() => void run(), options.delayMs);
  } else {
    await run();
  }
  return jobId;
}
