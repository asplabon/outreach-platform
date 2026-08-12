import { QUEUE_NAMES } from "@/lib/queue";
import { registerProcessor } from "@/lib/queue/processors";
import { syncRepliesForAllUsers } from "@/lib/replies/sync";

/** Phase 5: reply detection / Gmail thread sync. */
export function registerReplyProcessors(): void {
  registerProcessor(
    QUEUE_NAMES.reply,
    "sync-replies",
    () => syncRepliesForAllUsers(),
  );
}
