import * as t from "drizzle-orm/sqlite-core";
import { tEvmAddress, tBytes32, tJsonString, timestamps } from "../helpers";

export const users = t.sqliteTable("users", {
  walletAddress: tEvmAddress().primaryKey(),
  email: t.text(),
  lastActiveAt: t.integer().notNull(),
  keygenDataJson: tJsonString(),
  encryptionPublicKey: tBytes32(),
  authAddress: tEvmAddress(),

  ...timestamps,
});

export const profiles = t.sqliteTable("profiles", {
  walletAddress: tEvmAddress()
    .references(() => users.walletAddress, {
      onDelete: "cascade",
    })
    .primaryKey(),
  username: t.text().notNull().unique(),
  displayName: t.text().notNull(),
  avatarUrl: t.text(),
  bio: t.text().default(""),
  metadataJson: tJsonString().default({ value: "{}" }),
});
