import "dotenv/config";

import { Worker } from "bullmq";

import { getRedisConnection } from "@/lib/queue/connection";
import {
  getProcessor,
  getRegisteredJobNames,
  registerAllProcessors,
} from "@/lib/queue/processors";
import type { QueueName } from "@/lib/queue";

/**
 * Boot the BullMQ worker for a single queue. Only starts a worker if at least
 * one processor is registered for that queue — we never create a worker that
 * would silently accept and discard jobs.
 */
export async function bootWorker(queueName: QueueName): Promise<Worker | null> {
  registerAllProcessors();

  const jobNames = getRegisteredJobNames(queueName);
  if (jobNames.length === 0) {
    console.log(
      `[worker] queue "${queueName}" has no registered processors yet — worker not started`,
    );
    return null;
  }

  const connection = getRedisConnection();
  const worker = new Worker(
    queueName,
    async (job) => {
      const handler = getProcessor(queueName, job.name);
      if (!handler) {
        console.warn(
          `[worker] no handler for "${queueName}:${job.name}" (job ${job.id})`,
        );
        // Fail immediately (no retry storm) so it shows up in BullMQ's failed set.
        job.opts.attempts = 0;
        throw new Error(`No processor registered for ${queueName}:${job.name}`);
      }
      await handler({ jobId: job.id ?? "", name: job.name, data: job.data });
    },
    { connection },
  );

  worker.on("completed", (job) => {
    console.log(`[worker] completed ${queueName}:${job?.name} (${job?.id})`);
  });
  worker.on("failed", (job, error) => {
    console.error(
      `[worker] failed ${queueName}:${job?.name} (${job?.id})`,
      error,
    );
  });
  worker.on("error", (error) => {
    console.error(`[worker] connection error on "${queueName}":`, error);
  });

  console.log(
    `[worker] started: ${queueName} (processors: ${jobNames.join(", ")})`,
  );
  return worker;
}
