import config from "../../config";
import { and, eq, isNull, lte, ne, or, sql } from "drizzle-orm";
import db from "../db";
import type { TypedWorker } from "./worker";
import { tryCatch } from "../utils/tryCatch";

const { pendingJobs } = db.schema;

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

    const { error } = await tryCatch(
      db
        .delete(db.schema.pendingJobs)
        .where(eq(db.schema.pendingJobs.id, res.id))
    );
    if (error) {
      console.error("Failed to delete completed job:", res.id, error);
      db.update(db.schema.pendingJobs)
        .set({ lockedUntil: Infinity })
        .where(eq(db.schema.pendingJobs.id, res.id))
        .run();
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
        SELECT id FROM ${sql.identifier(pendingJobs._.name ?? "pending_jobs")}
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

async function handleJobFailure(jobId: string, err: unknown) {
  return db.transaction(async (tx) => {
    const job = tx
      .select()
      .from(pendingJobs)
      .where(eq(pendingJobs.id, jobId))
      .get();

    if (!job) return;

    const tries = (job.tries ?? 0) + 1;

    if (tries >= (job.maxAttempts ?? config.INDEXER.DEFAULT_MAX_JOB_ATTEMPTS)) {
      tx.update(pendingJobs)
        .set({
          lastError: String(err),
          nextAttemptAt: -1, // this means marked as permantantly faild
          lockedUntil: null,
        })
        .where(eq(pendingJobs.id, job.id))
        .run();
    } else {
      const nextAt = Date.now() + computeBackoffMs(tries);

      tx.update(pendingJobs)
        .set({
          lastError: String(err),
          nextAttemptAt: nextAt,
          lockedUntil: null,
          tries,
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

        db.delete(pendingJobs).where(eq(pendingJobs.id, job.id)).run();
      } catch (err) {
        await handleJobFailure(job.id, err);
      }
    } catch (err) {
      console.error("Job worker error:", err);
      await new Promise((r) => setTimeout(r, 8000));
    }
  }
}
