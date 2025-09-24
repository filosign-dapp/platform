import { Hono } from "hono";
import { startIndexer } from "./lib/indexer/engine";
import { startJobScheduler } from "./lib/indexer/scheduler";

startIndexer("FSFileRegistry");
startIndexer("FSKeyRegistry");
startIndexer("FSManager");
const workerId = `${require("os").hostname()}:${process.pid}`;
startJobScheduler(workerId);

// const app = new Hono();

// app.get("/", (c) => {
//   return c.text("Hello Hono!");
// });

// const port = 3000;
// console.log(`Server is running on port ${port}`);

// export default app;
