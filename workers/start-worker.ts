import { bootWorker } from "./boot";
import { QUEUE_NAMES } from "@/lib/queue";

/**
 * Boots every queue's worker in this process. Run with `npm run worker`.
 *
 * Note: workers are only meaningful in Redis mode (QUEUE_MODE=redis or auto
 * with REDIS_URL set). In in-process mode jobs run inside the web process, so
 * there is nothing for a worker to consume.
 */
async function main() {
  const workers = await Promise.all(
    Object.values(QUEUE_NAMES).map((name) => bootWorker(name)),
  );

  const started = workers.filter(Boolean).length;
  console.log(`[worker] all workers booted (${started} started). Ctrl+C to stop.`);

  const shutdown = async () => {
    console.log("[worker] shutting down...");
    await Promise.all(
      workers.filter(Boolean).map((w) => w?.close()),
    );
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("[worker] failed to boot workers:", error);
  process.exit(1);
});
