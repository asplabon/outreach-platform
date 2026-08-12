import { QUEUE_NAMES, type QueueHandler, type QueueJob, type QueueName } from "@/lib/queue";
import {
  syncCampaignStatus,
  type SyncCampaignStatusJob,
} from "@/lib/queue/processors/sheet-sync";
import { registerEmailProcessors } from "@/lib/queue/processors/email";

/**
 * Registry of (queue, jobName) → handler. Shared by both execution modes:
 *
 * - In-process mode: `enqueue()` looks up the handler here and runs it inline.
 * - Redis mode: the worker process registers handlers here too, and the BullMQ
 *   Worker dispatches each job to `getProcessor()`.
 *
 * Domain modules register their handlers via `registerAllProcessors()` below.
 * That function returns the number of handlers registered per queue so the
 * worker runner can refuse to boot a queue that has no processors yet.
 */

const handlers = new Map<string, QueueHandler>();

function keyOf(queue: QueueName, jobName: string): string {
  return `${queue}:${jobName}`;
}

export function registerProcessor<T>(
  queue: QueueName,
  jobName: string,
  handler: QueueHandler<T>,
): void {
  // The registry stores handlers as QueueHandler<unknown>. This is a deliberate
  // boundary cast: in Redis mode job data crosses the serialization boundary and
  // processors narrow it to their own `QueueJob<T>` types at runtime.
  handlers.set(keyOf(queue, jobName), handler as unknown as QueueHandler);
}

export function getProcessor(
  queue: QueueName,
  jobName: string,
): QueueHandler | undefined {
  return handlers.get(keyOf(queue, jobName));
}

/** Job names registered for a given queue. */
export function getRegisteredJobNames(queue: QueueName): string[] {
  const names: string[] = [];
  for (const key of handlers.keys()) {
    if (key.startsWith(`${queue}:`)) {
      names.push(key.slice(queue.length + 1));
    }
  }
  return names;
}

/**
 * Register every processor implemented so far. New processors are added by the
 * phase that implements them (sheet-sync → Phase 2, email → Phase 4,
 * reply → Phase 5, ai → Phase 6).
 *
 * @returns map of queue name → number of handlers registered for it
 */
export function registerAllProcessors(): Map<QueueName, number> {
  registerEmailProcessors();
  registerReplyProcessors();
  registerSheetSyncProcessors();
  registerAiProcessors();

  const counts = new Map<QueueName, number>();
  for (const key of handlers.keys()) {
    const [queue] = key.split(":") as [QueueName];
    counts.set(queue, (counts.get(queue) ?? 0) + 1);
  }
  return counts;
}

// Phase 4 (Gmail sending) handlers are registered by the imported
// registerEmailProcessors (../queue/processors/email.ts).

// Phase 5 (reply detection) registers its handlers here.
function registerReplyProcessors(): void {}

// Phase 2 (Sheet sync): writes campaign lead statuses back to the source sheet.
function registerSheetSyncProcessors(): void {
  registerProcessor(
    QUEUE_NAMES.sheetSync,
    "sync-campaign-status",
    (job: QueueJob<SyncCampaignStatusJob>) => syncCampaignStatus(job),
  );
}

// Phase 6 (AI classification / reply generation) registers its handlers here.
function registerAiProcessors(): void {}
