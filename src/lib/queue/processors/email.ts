import { QUEUE_NAMES } from "@/lib/queue";
import { registerProcessor } from "@/lib/queue/processors";
import type { QueueJob } from "@/lib/queue";
import {
  sendInitialMessage,
  type SendInitialJob,
} from "@/lib/email/send";

/** Phase 4: Gmail sending. */
export function registerEmailProcessors(): void {
  registerProcessor(
    QUEUE_NAMES.email,
    "send-initial",
    (job: QueueJob<SendInitialJob>) => sendInitialMessage(job),
  );
}