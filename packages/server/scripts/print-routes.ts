import { showRoutes, inspectRoutes } from "hono/dev";
import { app } from "..";

console.log(showRoutes(app, { verbose: true, colorize: true }));
