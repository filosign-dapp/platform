import {
  createPublicClient,
  http,
  type Chain,
  type PublicClient,
  type Transport,
} from "viem";
import { primaryChain } from "../../config";

export type ProviderLike = PublicClient<
  NonNullable<Transport>,
  NonNullable<Chain>
>;

export const getProvider: () => ProviderLike = () =>
  createPublicClient({
    transport: http(primaryChain.rpcUrls.default.http[0]),
    chain: primaryChain,
  });

export const provider = getProvider();
