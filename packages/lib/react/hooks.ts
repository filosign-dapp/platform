import { useFilosignContext } from "./FilosignProvider";

export function useFilosignClient() {
  const { client } = useFilosignContext();
  return client;
}
