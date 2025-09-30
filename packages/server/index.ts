import { Hono } from "hono";
import { startIndexer } from "./lib/indexer/engine";
import { startJobScheduler } from "./lib/jobrunner/scheduler";
import { apiRouter } from "./api/routes/router";

startIndexer("FSFileRegistry");
startIndexer("FSKeyRegistry");
startIndexer("FSManager");
const workerId = `${require("os").hostname()}:${process.pid}`;
startJobScheduler(workerId);

const app = new Hono().route("/api", apiRouter);

export default {
  port: 30011,
  fetch: app.fetch,
};
