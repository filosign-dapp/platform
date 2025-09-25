import {
  createPublicClient,
  http,
  type Chain,
  type PublicClient,
  type Transport,
} from "viem";
import { filecoinCalibration } from "viem/chains";

export type ProviderLike = PublicClient<
  NonNullable<Transport>,
  NonNullable<Chain>
>;

const network = filecoinCalibration;

export const getProvider: () => ProviderLike = () =>
  createPublicClient({
    transport: http(network.rpcUrls.default.http[0]),
    chain: network,
  });

export const provider = getProvider();
