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

export const shareApprovals = t.sqliteTable(
  "share_approvals",
  {
    id: t
      .text()
      .primaryKey()
      .$default(() => Bun.randomUUIDv7()),
    recipientWallet: tEvmAddress()
      .notNull()
      .references(() => users.walletAddress),
    senderWallet: tEvmAddress()
      .notNull()
      .references(() => users.walletAddress),

    active: tBoolean().notNull().default(false),
    lastChangedBlock: tBigInt(),
    lastTxHash: tHash(),

    ...timestamps,
  },
  (table) => [
    t
      .uniqueIndex("ux_share_approvals_recipient_sender")
      .on(table.recipientWallet, table.senderWallet),
    t.index("idx_share_approvals_recipient").on(table.recipientWallet),
    t.index("idx_share_approvals_sender").on(table.senderWallet),
  ]
);

export const shareApprovalHistory = t.sqliteTable(
  "share_approval_history",
  {
    id: t
      .text()
      .primaryKey()
      .$default(() => Bun.randomUUIDv7()),
    approvalId: t.text().notNull(), // references shareApprovals.id but we used string to avoid FK complexty
    action: t.text({ enum: ["ENABLED", "REVOKED"] }).notNull(),
    txHash: tHash().notNull(),
    blockNumber: t.integer("blockNumber").notNull(),

    createdAt: t
      .integer()
      .notNull()
      .$default(() => Date.now()),
  },
  (table) => [
    t
      .uniqueIndex("ux_share_approval_history_tx")
      .on(table.txHash, table.blockNumber),
    t.index("idx_share_approval_history_approval").on(table.approvalId),
  ]
);

export const shareRequests = t.sqliteTable("share_requests", {
  id: t
    .text()
    .primaryKey()
    .$default(() => Bun.randomUUIDv7()),
  senderWallet: tEvmAddress()
    .notNull()
    .references(() => users.walletAddress),
  recipientWallet: tEvmAddress().notNull(),
  status: t
    .text({ enum: ["PENDING", "ACCEPTED", "REJECTED", "CANCELLED", "EXPIRED"] })
    .notNull()
    .default("PENDING"),
  message: t.text(),
  metadata: tJsonString(),
  ...timestamps,
});
