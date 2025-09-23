import { eq } from "drizzle-orm";
import db from "../db";
import config from "../../config";
import type { IndexerCheckpointIdentifier } from "../db/schema/sys";
import { provider } from "./provider";
import { getContracts } from "@filosign/contracts";
import { bigIntMax, bigIntMin } from "../db/utils/math";
import { type GetLogsReturnType } from "viem";

const contracts = getContracts(provider);
const { indexerCheckpoints, pendingJobs } = db.schema;

async function getCheckpoint(identifier: IndexerCheckpointIdentifier) {
  const row = db
    .select()
    .from(indexerCheckpoints)
    .where(eq(indexerCheckpoints.identifier, identifier))
    .get();

  if (!row) {
    const res = db
      .insert(indexerCheckpoints)
      .values({
        identifier,
        blockHeight: config.INDEXER.DEFAULT_START_BLOCK,
      })
      .returning()
      .get();

    return res;
  }

  return row;
}

async function updateCheckpoint(
  identifier: IndexerCheckpointIdentifier,
  block: bigint
) {
  await db
    .update(indexerCheckpoints)
    .set({ blockHeight: block })
    .where(eq(indexerCheckpoints.identifier, identifier));
}

export async function startIndexer(contract: keyof typeof contracts) {
  const identifier = contract.toUpperCase() as Uppercase<typeof contract>;

  while (true) {
    try {
      const checkpoint = await getCheckpoint(identifier);
      const latest = await provider.getBlockNumber();
      const safeLatest = bigIntMax(0n, latest - config.INDEXER.CONFIRMATIONS);

      if (safeLatest <= checkpoint.blockHeight) {
        await new Promise((r) =>
          setTimeout(r, config.INDEXER.POLL_INTERVAL_MS)
        );
        continue;
      }

      const from = bigIntMax(0n, checkpoint.blockHeight + 1n);

      if (from > safeLatest) {
        await new Promise((r) =>
          setTimeout(r, config.INDEXER.POLL_INTERVAL_MS)
        );
        continue;
      }

      const to = bigIntMin(
        safeLatest,
        from + config.INDEXER.MAX_BATCH_BLOCKS - 1n
      );

      const logs = await provider.getLogs({
        fromBlock: from,
        toBlock: to,
        address: contracts[contract].address,
        events: contracts[contract].abi,
        strict: true,
      });

      logs.sort((a, b) => {
        if (a.blockNumber !== b.blockNumber)
          return Number(a.blockNumber - b.blockNumber);
        return (a.logIndex ?? 0) - (b.logIndex ?? 0);
      });

      for (const log of logs) {
        db.insert(pendingJobs).values({
          type: `${identifier}_EVENT_${log.eventName}`,
          payload: log,
        });
      }

      await updateCheckpoint(identifier, to);
    } catch (err) {
      console.error("Indexer error:", err);
      // backoff if there is error
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

export type ProviderLogEntry = GetLogsReturnType<
  undefined,
  (typeof contracts)[keyof typeof contracts]["abi"],
  true
>[number];
