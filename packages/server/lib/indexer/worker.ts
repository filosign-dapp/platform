import { getContracts } from "@filosign/contracts";
import { createDbClient } from "../db/client";
import schema from "../db/schema";
import type { ProviderLogEntry } from "./engine";
import { getProvider } from "./provider";
import { concatHex, toHex } from "viem";
import { eq } from "drizzle-orm";

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
  const contracts = getContracts(getProvider());
  // @ts-ignore This is th best we can do for now
  const log: ProviderLogEntry = job.payload;

  const jobTypeParts = job.type.split("_");

  if (jobTypeParts[0] === "EVENT") {
    const contractName = jobTypeParts[1];

    if (contractName === "FSManager") {
      if (log.eventName === "SenderApproved") {
        db.update(schema.shareApprovals)
          .set({
            active: true,
            lastChangedBlock: log.blockNumber,
            lastTxHash: log.transactionHash,
          })
          .run();
      }

      if (log.eventName === "SenderRevoked") {
        db.update(schema.shareApprovals)
          .set({
            active: false,
            lastChangedBlock: log.blockNumber,
            lastTxHash: log.transactionHash,
          })
          .run();
      }
    }

    if (contractName === "FSFileRegistry") {
      if (log.eventName === "FileRegistered") {
        const fileData = await contracts.FSFileRegistry.read.getFileData([
          log.args.cidIdentifier,
        ]);

        if (!fileData.pieceCidPrefix) {
          throw new Error(
            "No pieceCidPrefix in file data, invalid event maybe?"
          );
        }

        const cid = concatHex([
          fileData.pieceCidPrefix,
          toHex(fileData.pieceCidTail),
        ]);

        db.update(schema.files)
          .set({
            onchainTxHash: log.transactionHash,
          })
          .where(eq(schema.files.pieceCid, cid))
          .run();
      }

      if (log.eventName === "FileAcknowledged") {
        const fileData = await contracts.FSFileRegistry.read.getFileData([
          log.args.cidIdentifier,
        ]);

        if (!fileData.pieceCidPrefix) {
          throw new Error(
            "No pieceCidPrefix in file data, invalid event maybe?"
          );
        }

        const cid = concatHex([
          fileData.pieceCidPrefix,
          toHex(fileData.pieceCidTail),
        ]);

        const file = db
          .select()
          .from(schema.files)
          .where(eq(schema.files.pieceCid, cid))
          .get();

        if (!file) {
          throw new Error("File not found for FileAcknowledged event");
        }

        if (file.acknowledged) {
          if (file.acknowledgedTxHash === log.transactionHash) {
            return;
          } else {
            throw new Error(
              "Panic! File acknowledged yet event emitted again!"
            );
          }
        }

        db.update(schema.files)
          .set({
            acknowledged: true,
            acknowledgedTxHash: log.transactionHash,
          })
          .where(eq(schema.files.pieceCid, cid));
      }
    }
  }
}
