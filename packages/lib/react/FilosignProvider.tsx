import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { FilosignClient } from "..";
import type { FilosignClientConfig } from "../types/client";

type FilosignContext = {
  client: FilosignClient;
  initialize: () => Promise<void>;
  ready: boolean;
};

const FilosignContext = createContext<FilosignContext>({
  client: {} as any,
  initialize: async () => {},
  ready: false,
});

type FilosignConfig = {
  children: ReactNode;
  config: FilosignClientConfig;
};

export function FilosignProvider(props: FilosignConfig) {
  const { children, config } = props;
  const [client, setClient] = useState<FilosignClient>({} as any);
  const [ready, setReady] = useState<boolean>(false);

  async function initialize() {
    const fsClient = new FilosignClient(config);
    fsClient.initialize().then(() => setReady(true));

    setClient(fsClient);
  }

  const value: FilosignContext = {
    client,
    ready,
    initialize,
  };

  return createElement(FilosignContext.Provider, { value }, children);
}

export function useFilosignContext() {
  return useContext(FilosignContext);
}
