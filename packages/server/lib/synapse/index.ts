import { Synapse, RPC_URLS } from "@filoz/synapse-sdk";
import env from "../../env";

const synapse = await Synapse.create({
  privateKey: env.EVM_PRIVATE_KEY_SYNAPSE,
  rpcURL: RPC_URLS.calibration.websocket,
  withCDN: true,
});
