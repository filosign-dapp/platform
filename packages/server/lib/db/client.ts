import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import schema from "./schema";
import { SQL } from "bun";
import { sqliteFile } from "../../drizzle.config";

function getSqliteClient() {
  const sqlite = new Database(sqliteFile);
  sqlite.run("PRAGMA foreign_keys = ON");
  return sqlite;
}

export const createDbClient = () =>
  drizzle({
    client: getSqliteClient(),
    schema: schema,
    casing: "snake_case",
  });

const dbClient = createDbClient();

export default dbClient;
export const sql = new SQL(sqliteFile);
