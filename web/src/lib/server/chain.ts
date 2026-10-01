import "server-only";
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodTestnet, arbitrumSepolia, type SupportedChainId } from "@/lib/chains";

export const MAINNET_RPC = process.env.RH_MAINNET_RPC ?? "https://rpc.mainnet.chain.robinhood.com";

export const robinhoodMainnet = {
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [MAINNET_RPC] } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" as const } },
} as const;

export const chainOf = (id: SupportedChainId) => (id === 46630 ? robinhoodTestnet : arbitrumSepolia);

export function isSupported(id: number): id is SupportedChainId {
  return id === 46630 || id === 421614;
}

export const pub = (id: SupportedChainId) => createPublicClient({ chain: chainOf(id), transport: http() });
export const mainnet = () => createPublicClient({ chain: robinhoodMainnet, transport: http() });

export function signer(envKey: "RELAY_PRIVATE_KEY" | "DRIP_PRIVATE_KEY", id: SupportedChainId) {
  const pk = process.env[envKey];
  if (!pk) throw new Error(`${envKey} not configured`);
  const account = privateKeyToAccount(pk as Hex);
  return createWalletClient({ account, chain: chainOf(id), transport: http() });
}

/** Arbitrum chains: pay base fee with headroom, no tip, fixed gas → one RPC round trip per tx. */
export const FEES = { maxFeePerGas: 200_000_000n, maxPriorityFeePerGas: 0n } as const;
