import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import schema from "./schema";
import { SQL } from "bun";
import { sqliteFile } from "../../drizzle.config";

const sqlite = new Database(sqliteFile);
sqlite.run("PRAGMA foreign_keys = ON");

export const createDbClient = () =>
  drizzle({
    client: sqlite,
    schema: schema,
    casing: "snake_case",
  });

const dbClient = createDbClient();

export default dbClient;
export const sql = new SQL(sqliteFile);
