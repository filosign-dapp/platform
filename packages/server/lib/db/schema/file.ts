import * as t from "drizzle-orm/sqlite-core";
import {
  tBigInt,
  tBoolean,
  tEvmAddress,
  tHash,
  timestamps,
  tJsonString,
} from "../helpers";
import { users } from "./user";

export const files = t.sqliteTable(
  "files",
  {
    cid: t.text().primaryKey(),
    ownerWallet: tEvmAddress()
      .notNull()
      .references(() => users.walletAddress),
    recipientWallet: tEvmAddress()
      .notNull()
      .references(() => users.walletAddress),

    encryptedKey: t.text(),
    metadata: tJsonString().notNull(),

    onchainRegistered: tBoolean().notNull().default(false),
    onchainTxHash: tHash(),

    ...timestamps,
  },
  (table) => [
    t.index("idx_files_owner").on(table.ownerWallet),
    t.index("idx_files_recipient").on(table.recipientWallet),
    t.index("idx_files_cididentifier").on(table.cid),
  ]
);

export const fileSignatures = t.sqliteTable(
  "file_signatures",
  {
    id: t.text().primaryKey().default("uuid_generate_v4()"),
    fileCid: t
      .text()
      .notNull()
      .references(() => files.cid, { onDelete: "cascade" }),
    signerWallet: t.text().notNull(),
    signatureVisualHash: tHash().notNull(),
    compactSignature: t.text().notNull(),
    timestamp: t.text().notNull(),
    onchainTxHash: t.text(),
  },
  (table) => [t.index("idx_signatures_file").on(table.fileCid)]
);
