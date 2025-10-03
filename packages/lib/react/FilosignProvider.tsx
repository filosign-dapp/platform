import { createContext, useContext, useEffect, useRef, useState } from "react";
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
  children: React.ReactNode;
  config: FilosignClientConfig;
};

export function BeaverProvider(props: FilosignConfig) {
  const { children, config } = props;
  const [client, setClient] = useState<FilosignClient>({} as any);
  const [ready, setReady] = useState<boolean>(false);

  const flag = useRef(false);

  function init() {
    const fsClient = new FilosignClient(config);
    fsClient.initialize().then(() => setReady(true));

    setClient(fsClient);
  }

  const value: FilosignContext = {
    client,
    ready,
  };

  useEffect(() => {
    if (!flag.current) {
      flag.current = true;
      init();
    }
  }, [config]);

  return (
    <FilosignContext.Provider value={value}>
      {children}
    </FilosignContext.Provider>
  );
}

export function useFilosignContext() {
  return useContext(FilosignContext);
}
