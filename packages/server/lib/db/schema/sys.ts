import * as t from "drizzle-orm/sqlite-core";
import { timestamps, tJsonString } from "../helpers";

export const indexerCheckpoints = t.sqliteTable("indexer_checkpoints", {
  identifier: t.text().primaryKey(),
  blockHeight: t.integer().notNull(),
});

export const pendingJobs = t.sqliteTable(
  "pending_jobs",
  {
    id: t.text().primaryKey(),
    type: t.text().notNull(),
    payload: tJsonString().notNull(),

    status: t
      .text({ enum: ["PENDING", "RUNNING", "DONE", "CANCELLED", "FAILED"] })
      .notNull()
      .default("PENDING"),
    tries: t.integer("tries").notNull().default(0),
    maxAttempts: t.integer("maxAttempts").notNull().default(5),

    next_attempt: t.text(),
    last_error: t.text(),
    ...timestamps,
  },
  (table) => [t.index("idx_pending_jobs_type").on(table.type)]
);
