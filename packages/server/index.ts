import { Hono } from "hono";
import { startIndexer } from "./lib/indexer/engine";
import { startJobScheduler } from "./lib/indexer/scheduler";
import analytics from "./lib/analytics/logger";

startIndexer("FSFileRegistry");
startIndexer("FSKeyRegistry");
startIndexer("FSManager");
const workerId = `${require("os").hostname()}:${process.pid}`;
startJobScheduler(workerId);

const app = new Hono().get("/", (c) => {
  return c.text("Hello Hono!");
});

export default {
  port: 30011,
  fetch: app.fetch,
};
