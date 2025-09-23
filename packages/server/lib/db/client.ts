import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import schema from "./schema";
import { eq } from "drizzle-orm";
import { SQL } from "bun";

const sqliteFile = process.env.SQLITE_FILE || "./filosign.db";

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
