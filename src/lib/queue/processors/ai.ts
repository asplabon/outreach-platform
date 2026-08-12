import { QUEUE_NAMES } from "@/lib/queue";
import { registerProcessor } from "@/lib/queue/processors";
import type { QueueJob } from "@/lib/queue";
import {
  processPendingReplies,
  processReply,
  type ProcessReplyJob,
} from "@/lib/ai/replies";

/** Phase 6: AI classification + reply drafting. */
export function registerAiProcessors(): void {
  registerProcessor(
    QUEUE_NAMES.ai,
    "process-pending",
    () => processPendingReplies(),
  );
  registerProcessor(
    QUEUE_NAMES.ai,
    "process-reply",
    (job: QueueJob<ProcessReplyJob>) => processReply(job.data.replyId),
  );
}
