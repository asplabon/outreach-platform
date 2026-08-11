import { bootWorker } from "./boot";
import { QUEUE_NAMES } from "@/lib/queue";

// Reply detection worker (Phase 5). Run with `npm run worker:reply`.
async function main() {
  const worker = await bootWorker(QUEUE_NAMES.reply);
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
  console.error("[worker:reply] failed to boot:", error);
  process.exit(1);
});
