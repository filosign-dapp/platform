import { Synapse, RPC_URLS } from "@filoz/synapse-sdk";
import env from "../../env";
import db from "../db";
import { eq } from "drizzle-orm";
import type { Address } from "viem";
import { tryCatch } from "../utils/tryCatch";

const WITH_CDN = false;

export const synapse = await Synapse.create({
  privateKey: env.EVM_PRIVATE_KEY_SYNAPSE,
  rpcURL: RPC_URLS.calibration.websocket,
  withCDN: WITH_CDN,
});

export async function getOrCreateUserDataset(walletAddress: Address) {
  const existing = db
    .select()
    .from(db.schema.usersDatasets)
    .where(eq(db.schema.usersDatasets.walletAddress, walletAddress))
    .get();
  if (existing) {
    const ctx = await tryCatch(
      synapse.storage.createContext({
        dataSetId: existing.dataSetId,
        providerAddress: existing.providerAddress,
        metadata: { filosign_user: walletAddress },
      })
    );

    if (ctx.error) {
      throw new Error(
        "Fail to create synapse context for existing user dataset"
      );
    }

    return ctx.data;
  }

  const ctx = await tryCatch(
    synapse.storage.createContext({
      metadata: { filosign_user: walletAddress },
    })
  );

  if (ctx.error) {
    throw new Error("Fail to create synapse context for new user dataset");
  }

  db.insert(db.schema.usersDatasets)
    .values({
      walletAddress,
      dataSetId: ctx.data.dataSetId,
      providerAddress: ctx.data.provider.serviceProvider,
    })
    .run();

  return ctx.data;
}
