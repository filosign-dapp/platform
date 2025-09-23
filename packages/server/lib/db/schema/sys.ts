import * as t from "drizzle-orm/sqlite-core";
import { tBigInt, timestamps, tJsonString } from "../helpers";

export const indexerCheckpoints = t.sqliteTable("indexer_checkpoints", {
  identifier: t
    .text({
      //  enum: ["FSMANAGER", "FSFILEREGISTRY", "FSKEYREGISTRY"]
    })
    .primaryKey(),
  blockHeight: tBigInt().notNull(),
  ...timestamps,
});

export type IndexerCheckpointIdentifier =
  typeof indexerCheckpoints.$inferSelect.identifier;

export const pendingJobs = t.sqliteTable(
  "pending_jobs",
  {
    id: t
      .text()
      .primaryKey()
      .$default(() => Bun.randomUUIDv7()),
    type: t.text().notNull(),
    payload: tJsonString().notNull(),

    tries: t.integer("tries").notNull().default(0),
    maxAttempts: t.integer("maxAttempts").notNull().default(5),

    nextAttemptAt: t
      .integer()
      .notNull()
      .$default(() => Date.now()),
    lastError: t.text(),

    lockedUntil: t.integer(),
    lockedBy: t.text(),

    ...timestamps,
  },
  (table) => [t.index("idx_pending_jobs_type").on(table.type)]
);
