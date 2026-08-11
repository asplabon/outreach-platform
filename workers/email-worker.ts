import { bootWorker } from "./boot";
import { QUEUE_NAMES } from "@/lib/queue";

// Gmail sending worker (Phase 4). Run with `npm run worker:email`.
async function main() {
  const worker = await bootWorker(QUEUE_NAMES.email);
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
  console.error("[worker:email] failed to boot:", error);
  process.exit(1);
});
