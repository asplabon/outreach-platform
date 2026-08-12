import "dotenv/config";

import { Worker, Queue as BullQueue } from "bullmq";

import { getRedisConnection } from "@/lib/queue/connection";
import {
  getProcessor,
  getRegisteredJobNames,
  registerAllProcessors,
} from "@/lib/queue/processors";
import { QUEUE_NAMES, type QueueName } from "@/lib/queue";
import { env } from "@/lib/env";

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

/**
 * Register BullMQ repeatable jobs that drive periodic work (Redis mode only —
 * in-process dev uses a lighter interval inside the web process). Returns the
 * handles so callers can close them on shutdown.
 */
export async function scheduleRepeatableJobs(): Promise<BullQueue[]> {
  const queues = new Map<QueueName, BullQueue>();
  const getQueue = (name: QueueName): BullQueue => {
    let q = queues.get(name);
    if (!q) {
      q = new BullQueue(name, { connection: getRedisConnection() });
      queues.set(name, q);
    }
    return q;
  };

  // Reply sync: scan Gmail threads for new replies every N minutes.
  await getQueue(QUEUE_NAMES.reply).upsertJobScheduler(
    "reply-sync-scheduler",
    { every: env.REPLY_SYNC_INTERVAL_MINUTES * 60_000 },
    { name: "sync-replies", data: {} },
  );

  // Follow-up dispatch: wake up due campaign leads every minute.
  await getQueue(QUEUE_NAMES.email).upsertJobScheduler(
    "followup-scheduler",
    { every: 60_000 },
    { name: "process-followups", data: {} },
  );

  console.log(
    `[worker] repeatable jobs scheduled: reply sync (every ${env.REPLY_SYNC_INTERVAL_MINUTES}m), follow-up dispatch (every 1m)`,
  );
  return [...queues.values()];
}
