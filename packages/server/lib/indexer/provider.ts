import {
  createPublicClient,
  webSocket,
  type Chain,
  type PublicClient,
  type Transport,
} from "viem";
import { filecoinCalibration } from "viem/chains";

export type ProviderLike = PublicClient<
  NonNullable<Transport>,
  NonNullable<Chain>
>;

export const provider: ProviderLike = createPublicClient({
  transport: webSocket("wss://wss.node.glif.io/apigw/lotus/rpc/v1"),
  chain: filecoinCalibration,
});
