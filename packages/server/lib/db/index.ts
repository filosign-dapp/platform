import schema from "./schema";
import dbClient from "./client";

const db = {
  ...dbClient,
  select: dbClient.select.bind(dbClient),
  insert: dbClient.insert.bind(dbClient),
  update: dbClient.update.bind(dbClient),
  delete: dbClient.delete.bind(dbClient),
  transaction: dbClient.transaction.bind(dbClient),
  query: dbClient.query,
  //   ...dbExtensionHelpers,
  schema,
};

export default db;
