import { bootWorker } from "./boot";
import { QUEUE_NAMES } from "@/lib/queue";

// Sheet status sync worker (Phase 2). Run with `npm run worker:sheets`.
async function main() {
  const worker = await bootWorker(QUEUE_NAMES.sheetSync);
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
  console.error("[worker:sheets] failed to boot:", error);
  process.exit(1);
});
