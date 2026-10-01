import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { createPublicClient, http as vhttp, type PublicClient } from "viem";
import { robinhoodTestnet, arbitrumSepolia, type SupportedChainId } from "./chains";

export const wagmiConfig = createConfig({
  chains: [robinhoodTestnet, arbitrumSepolia],
  connectors: [injected()],
  transports: {
    [robinhoodTestnet.id]: http(robinhoodTestnet.rpcUrls.default.http[0], { batch: true }),
    [arbitrumSepolia.id]: http(arbitrumSepolia.rpcUrls.default.http[0], { batch: true }),
  },
  ssr: true,
});

const clients = new Map<number, PublicClient>();
export function publicClient(id: SupportedChainId): PublicClient {
  if (!clients.has(id)) {
    const chain = id === robinhoodTestnet.id ? robinhoodTestnet : arbitrumSepolia;
    clients.set(id, createPublicClient({ chain, transport: vhttp(chain.rpcUrls.default.http[0], { retryCount: 3 }) }) as PublicClient);
  }
  return clients.get(id)!;
}
