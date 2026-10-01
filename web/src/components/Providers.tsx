"use client";
import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi";
import { DEFAULT_CHAIN_ID, type SupportedChainId } from "@/lib/chains";

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: false } } });

// Selected network lives in localStorage; read it as an external store so SSR renders the default.
const KEY = "tape:chain";
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => (listeners.add(fn), () => listeners.delete(fn));
function read(): SupportedChainId {
  try {
    const v = Number(localStorage.getItem(KEY));
    return v === 421614 ? 421614 : 46630;
  } catch {
    return DEFAULT_CHAIN_ID;
  }
}
function write(id: SupportedChainId) {
  try {
    localStorage.setItem(KEY, String(id));
  } catch {}
  listeners.forEach((l) => l());
}

type Net = { chainId: SupportedChainId; setChainId: (id: SupportedChainId) => void };
const NetCtx = createContext<Net>({ chainId: DEFAULT_CHAIN_ID, setChainId: () => {} });
export const useNetwork = () => useContext(NetCtx);

export function Providers({ children }: { children: ReactNode }) {
  const chainId = useSyncExternalStore(subscribe, read, () => DEFAULT_CHAIN_ID);
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={qc}>
        <NetCtx.Provider value={{ chainId, setChainId: write }}>{children}</NetCtx.Provider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
