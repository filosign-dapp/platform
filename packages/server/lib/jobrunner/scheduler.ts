import config from "../../config";
import { eq, lte, sql } from "drizzle-orm";
import db from "../db";
import type { TypedWorker } from "./worker";
import tryCatchSync, { tryCatch } from "../utils/tryCatch";

const { pendingJobs } = db.schema;

export async function enqueueJob(options: { type: string; payload: any }) {
  const { type, payload } = options;
  await db.insert(pendingJobs).values({
    type,
    payload,
  });
}

const w = new Worker(new URL("./worker.ts", import.meta.url), {
  type: "module",
}) as unknown as TypedWorker;

w.addEventListener("message", async (e) => {
  const res = e.data;

  if (res.error) {
    console.error("Job failed:", res.id, res.error);

    const { error } = await tryCatch(handleJobFailure(res.id, res.error));
    if (error) {
      console.error("Failed to handle job failure:", res.id, error);
    }
    return;
  }

  if (res.result) {
    console.log("Job completed:", res.id);

    const { error } = tryCatchSync(() =>
      db
        .delete(db.schema.pendingJobs)
        .where(eq(db.schema.pendingJobs.id, res.id))
        .run()
    );
    if (error) {
      console.error("Failed to delete completed job:", res.id, error);
      const { error: updateError } = tryCatchSync(() =>
        db
          .update(db.schema.pendingJobs)
          .set({ nextAttemptAt: -1, lockedUntil: null })
          .where(eq(db.schema.pendingJobs.id, res.id))
          .run()
      );
      if (updateError) {
        console.error(
          "Failed to mark job as failed after delete failure:",
          res.id,
          updateError
        );
      }
    }
    return;
  }
});

function computeBackoffMs(attempts: number) {
  const base = 1000;
  const cap = 60 * 60 * 1000;
  const jitter = Math.floor(Math.random() * 1000);
  return Math.min(cap, base * Math.pow(2, attempts - 1)) + jitter;
}

async function claimOneJob(workerId: string) {
  return db.transaction(async (tx) => {
    const now = Date.now();
    const lockUntil = now + config.INDEXER.JOB_LOCK_TTL_MS;

    const nextJob = tx
      .update(pendingJobs)
      .set({
        lockedUntil: lockUntil,
        lockedBy: workerId,
        tries: sql`COALESCE(${pendingJobs.tries}, 0) + 1`,
      })
      .where(
        sql`${pendingJobs.id} = (
        SELECT id FROM ${sql.identifier("pending_jobs")}
        WHERE ${pendingJobs.nextAttemptAt} <= ${now}
          AND ${pendingJobs.nextAttemptAt} != -1
          AND (${pendingJobs.lockedUntil} IS NULL OR ${
          pendingJobs.lockedUntil
        } <= ${now})
        ORDER BY ${pendingJobs.nextAttemptAt}
        LIMIT 1
      )`
      )
      .returning()
      .get();

    if (!nextJob) return null;

    return nextJob;
  });
}

async function handleJobFailure(jobId: string, errMsg: string) {
  return db.transaction(async (tx) => {
    const job = tx
      .select()
      .from(pendingJobs)
      .where(eq(pendingJobs.id, jobId))
      .get();

    if (!job) return;

    const tries = job.tries ?? 0;
    const maxAttempts =
      job.maxAttempts ?? config.INDEXER.DEFAULT_MAX_JOB_ATTEMPTS;

    if (tries >= maxAttempts) {
      tx.update(pendingJobs)
        .set({
          lastError: String(errMsg),
          nextAttemptAt: -1, // this means marked as permantantly faild
          lockedUntil: null,
        })
        .where(eq(pendingJobs.id, job.id))
        .run();
    } else {
      const nextAt = Date.now() + computeBackoffMs(tries);

      tx.update(pendingJobs)
        .set({
          lastError: String(errMsg),
          nextAttemptAt: nextAt,
          lockedUntil: null,
          lockedBy: null,
        })
        .where(eq(pendingJobs.id, job.id))
        .run();
    }
  });
}

export async function startJobScheduler(workerId: string) {
  while (true) {
    try {
      const job = await claimOneJob(workerId);
      if (!job) {
        await new Promise((r) => setTimeout(r, 2000)); // small sleep, gn gn
        continue;
      }

      try {
        w.postMessage(job);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await handleJobFailure(job.id, errMsg);
      }
    } catch (err) {
      console.error("Job worker error:", err);
      await new Promise((r) => setTimeout(r, 8000));
    }
  }
}

export async function stopScheduler() {
  w.terminate();
}
