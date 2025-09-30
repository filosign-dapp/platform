import { Hono } from "hono";
import requests from "./requests";

export const apiRouter = new Hono().route("/requests", requests);
