import { Synapse, RPC_URLS } from "@filoz/synapse-sdk";
import { keccak256 } from "viem";
import { jsonStringify } from "../../../lib/utils/json";

const KB = 1024;
const MB = KB * 1024;

const sizeBytes = 100 * MB;

const synapse = await Synapse.create({
  privateKey: keccak256(Uint8Array.from(crypto.randomUUID())),
  rpcURL: RPC_URLS.calibration.websocket,
});

const preflight = await synapse.storage.preflightUpload(sizeBytes, {
  withCDN: false,
});
console.log("preflightUpload ->", jsonStringify(preflight));

console.log("per day : ", preflight.estimatedCost.perDay);
