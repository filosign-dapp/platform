import { createDbClient } from "../db/client";
import schema from "../db/schema";
import type { ProviderLogEntry } from "./engine";

type Job = typeof schema.pendingJobs.$inferSelect;
type Incoming = Job;
type Outgoing = { id: Job["id"] } & (
  | { result: NonNullable<any>; error: null }
  | { result: null; error: Job["lastError"] }
);

export type TypedWorker = Omit<Worker, "postMessage" | "addEventListener"> & {
  postMessage(msg: Incoming): void;
  addEventListener(
    type: "message",
    listener: (ev: MessageEvent<Outgoing>) => void
  ): void;
};

addEventListener("message", (ev: MessageEvent<Incoming>) => {
  const job = ev.data;
  processJob(job);
});

async function processJob(job: Job) {
  const db = createDbClient();
  // @ts-ignore This is th best we can do for now
  const log: ProviderLogEntry = job.payload;

  if (job.type.startsWith("FSFILEREGISTRY_EVENT_")) {
    const eventName = job.type.replace("FSFILEREGISTRY_EVENT_", "");

    if (eventName === "SenderApproved") {
      db.update(schema.shareApprovals).set({
        active: true,
        lastChangedBlock: log.blockNumber,
        lastTxHash: log.transactionHash,
      });
    }
    if (eventName === "SenderRevoked") {
      db.update(schema.shareApprovals).set({
        active: false,
        lastChangedBlock: log.blockNumber,
        lastTxHash: log.transactionHash,
      });
    }
  }
}
