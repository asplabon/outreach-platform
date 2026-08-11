import type { QueueHandler, QueueName } from "@/lib/queue";

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

export function registerProcessor(
  queue: QueueName,
  jobName: string,
  handler: QueueHandler,
): void {
  handlers.set(keyOf(queue, jobName), handler);
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

// Phase 4 (Gmail sending) registers its handlers here.
function registerEmailProcessors(): void {}

// Phase 5 (reply detection) registers its handlers here.
function registerReplyProcessors(): void {}

// Phase 2 (Sheet sync) registers its handlers here.
function registerSheetSyncProcessors(): void {}

// Phase 6 (AI classification / reply generation) registers its handlers here.
function registerAiProcessors(): void {}
