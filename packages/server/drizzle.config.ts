import { defineConfig } from "drizzle-kit";

export const sqliteFile = "./filosign.db";

export default defineConfig({
  out: "./drizzle",
  schema: "./lib/db/schema",
  dialect: "sqlite",
  dbCredentials: {
    url: sqliteFile,
  },
  casing: "snake_case",
});
