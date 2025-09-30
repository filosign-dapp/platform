import { eq } from "drizzle-orm";
import db from "../db";
import config from "../../config";
import type { IndexerCheckpointIdentifier } from "../db/schema/sys";
import { provider } from "./provider";
import { getContracts } from "@filosign/contracts";
import { bigIntMax, bigIntMin } from "../utils/math";
import { type GetLogsReturnType } from "viem";
import { enqueueJob } from "../jobrunner/scheduler";

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

async function estimateAvgBlockTimeMs() {
  const SAMPLE = 20n;

  const latest = await provider.getBlockNumber();
  const start = bigIntMax(1n, latest - SAMPLE);
  const first = await provider.getBlock({ blockNumber: start });
  const last = await provider.getBlock({ blockNumber: latest });

  if (!first || !last) throw new Error("failed to read blocks for avg time");

  const seconds = last.timestamp - first.timestamp;
  const blocks = latest - start;

  return Number((seconds / bigIntMax(1n, blocks)) * 1000n);
}

async function findLookableBlockAtOrAfter(targetBlockNumber: bigint) {
  const latestBlockNumber = await provider.getBlockNumber();
  const lookbackBlockTimestampMs =
    Date.now() - config.INDEXER.MAX_NODE_LOOKBACK_PERIOD_MS;
  const lookbackBlockThreshold = BigInt(Math.floor(lookbackBlockTimestampMs));

  try {
    //atempt to search using binary search
    const targetBlock = await provider.getBlock({
      blockNumber: targetBlockNumber,
    });

    if (!targetBlock)
      throw new Error(`target block ${String(targetBlockNumber)} not found`);

    if (targetBlock.timestamp >= lookbackBlockThreshold) return targetBlock;

    let low = targetBlockNumber + 1n;
    let high = latestBlockNumber;

    while (low < high) {
      const mid = (low + high + 1n) / 2n;
      const midBlock = await provider.getBlock({ blockNumber: mid });
      if (!midBlock) {
        high = mid - 1n;
        continue;
      }
      if (midBlock.timestamp < lookbackBlockThreshold) {
        low = mid + 1n;
      } else {
        high = mid;
      }
    }
    const resultBlock = await provider.getBlock({ blockNumber: low });

    if (resultBlock.timestamp < lookbackBlockThreshold)
      throw new Error("no lookable block found");
    if (!resultBlock) throw new Error("block not found after binary search");

    return resultBlock;
  } catch (e) {
    const estimatedBlockTime = await estimateAvgBlockTimeMs();
    const allowedLookbackBlocks =
      config.INDEXER.MAX_NODE_LOOKBACK_PERIOD_MS / estimatedBlockTime;

    const lookableBlock = await provider.getBlock({
      blockNumber: latestBlockNumber - BigInt(allowedLookbackBlocks),
    });

    if (!lookableBlock) throw new Error("failed to find lookable block");
    return lookableBlock;
  }
}

export async function startIndexer(contract: keyof typeof contracts) {
  const identifier = contract.toUpperCase() as Uppercase<typeof contract>;
  console.log(`Starting indexer -> ${identifier}`);

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

      const from = bigIntMax(0n, checkpoint.blockHeight);

      const { number: lookableBlock } = await findLookableBlockAtOrAfter(from);

      if (lookableBlock > safeLatest) {
        await new Promise((r) =>
          setTimeout(r, config.INDEXER.POLL_INTERVAL_MS)
        );
        continue;
      }

      const to = bigIntMin(
        safeLatest,
        lookableBlock + config.INDEXER.MAX_BATCH_BLOCKS - 1n
      );

      const logs = await provider.getLogs({
        fromBlock: lookableBlock,
        toBlock: to,
        address: contracts[contract].address,
        events: contracts[contract].abi.filter((x: any) => x.type === "event"),
        strict: true,
      });

      logs.sort((a, b) => {
        if (a.blockNumber !== b.blockNumber)
          return Number(a.blockNumber - b.blockNumber);
        return (a.logIndex ?? 0) - (b.logIndex ?? 0);
      });

      for (const log of logs) {
        enqueueJob({
          type: `EVENT:${contract}:${log.eventName}`,
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
