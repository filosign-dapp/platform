import config from "../../config";
import { and, eq, isNull, lte, ne, or } from "drizzle-orm";
import db from "../db";
import type { TypedWorker } from "./worker";

const w = new Worker(new URL("./worker.ts", import.meta.url), {
  type: "module",
}) as unknown as TypedWorker;

w.addEventListener("message", (ev) => {
  const res = ev.data;
  if (res.error) {
    handleJobFailure(res.id, res.error);
  }
  if (res.result) {
    console.log("Job completed:", res.id);
  }
});

const { pendingJobs } = db.schema;

function computeBackoffMs(attempts: number) {
  const base = 1000;
  const cap = 60 * 60 * 1000;
  const jitter = Math.floor(Math.random() * 1000);
  return Math.min(cap, base * Math.pow(2, attempts - 1)) + jitter;
}

async function claimOneJob(workerId: string) {
  return db.transaction(async (tx) => {
    const now = Date.now();
    const nextJob = tx
      .select()
      .from(pendingJobs)
      .where(
        and(
          lte(pendingJobs.nextAttemptAt, now),
          ne(pendingJobs.nextAttemptAt, -1),
          or(isNull(pendingJobs.lockedUntil), lte(pendingJobs.lockedUntil, now))
        )
      )
      .orderBy(pendingJobs.nextAttemptAt)
      .get();

    if (!nextJob) return null;

    const lockUntil = Date.now() + config.INDEXER.JOB_LOCK_TTL_MS;

    const job = tx
      .update(pendingJobs)
      .set({
        lockedUntil: lockUntil,
        lockedBy: workerId,
        tries: (nextJob.tries ?? 0) + 1,
      })
      .where(eq(pendingJobs.id, nextJob.id))
      .returning()
      .get();

    return job;
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
