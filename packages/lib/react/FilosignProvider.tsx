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
  ready: boolean;
};

const FilosignContext = createContext<FilosignContext>({
  client: {} as any,
  ready: false,
});

type FilosignConfig = {
  children: ReactNode;
  config: {
    wallet?: FilosignClientConfig["wallet"];
    apiBaseUrl: FilosignClientConfig["apiBaseUrl"];
    debug?: FilosignClientConfig["debug"];
  };
};

export function FilosignProvider(props: FilosignConfig) {
  const { children, config } = props;
  const [client, setClient] = useState<FilosignClient>({} as any);
  const [ready, setReady] = useState<boolean>(false);

  const flag = useRef(false);

  const value: FilosignContext = {
    client,
    ready,
  };

  useEffect(() => {
    if (!flag.current && config.wallet) {
      flag.current = true;

      const fsClient = new FilosignClient({
        apiBaseUrl: config.apiBaseUrl,
        wallet: config.wallet,
        debug: config.debug,
      });
      fsClient.initialize().then(() => setReady(true));

      setClient(fsClient);
    }
  }, [config, config.wallet]);

  return createElement(FilosignContext.Provider, { value }, children);
}

export function useFilosignContext() {
  return useContext(FilosignContext);
}
