import * as t from "drizzle-orm/sqlite-core";

export const lastSyncedBlockHeights = t.sqliteTable(
  "last_synced_block_heights",
  {
    identifier: t.text().primaryKey(),
    blockHeight: t.integer().notNull(),
  }
);
