import { bootWorker } from "./boot";
import { QUEUE_NAMES } from "@/lib/queue";

// AI classification / reply generation worker (Phase 6). Run with `npm run worker:ai`.
async function main() {
  const worker = await bootWorker(QUEUE_NAMES.ai);
  if (!worker) {
    process.exit(0);
  }
  const shutdown = () => {
    void worker.close().then(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("[worker:ai] failed to boot:", error);
  process.exit(1);
});
