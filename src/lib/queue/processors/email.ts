import { QUEUE_NAMES } from "@/lib/queue";
import { registerProcessor } from "@/lib/queue/processors";
import type { QueueJob } from "@/lib/queue";
import {
  sendInitialMessage,
  type SendInitialJob,
} from "@/lib/email/send";
import {
  processDueFollowUps,
  sendFollowUpMessage,
  type SendFollowUpJob,
} from "@/lib/email/followup";

/** Phase 4 + 5: Gmail sending and follow-ups. */
export function registerEmailProcessors(): void {
  registerProcessor(
    QUEUE_NAMES.email,
    "send-initial",
    (job: QueueJob<SendInitialJob>) => sendInitialMessage(job),
  );
  registerProcessor(
    QUEUE_NAMES.email,
    "send-followup",
    (job: QueueJob<SendFollowUpJob>) => sendFollowUpMessage(job),
  );
  registerProcessor(
    QUEUE_NAMES.email,
    "process-followups",
    () => processDueFollowUps(),
  );
}