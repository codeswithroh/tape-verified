import { defineChain } from "viem";
import { arbitrumSepolia as arbSep } from "viem/chains";

const multicall3 = { address: "0xcA11bde05977b3631167028862bE2a173976CA11" as const };

export const robinhoodTestnet = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.chain.robinhood.com"] } },
  blockExplorers: { default: { name: "Explorer", url: "https://explorer.testnet.chain.robinhood.com" } },
  contracts: { multicall3 },
  testnet: true,
});

export const arbitrumSepolia = defineChain({
  ...arbSep,
  rpcUrls: { default: { http: ["https://arbitrum-sepolia-rpc.publicnode.com"] } },
  contracts: { ...arbSep.contracts, multicall3 },
});

export const CHAINS = [robinhoodTestnet, arbitrumSepolia] as const;
export type SupportedChainId = (typeof CHAINS)[number]["id"];
export const DEFAULT_CHAIN_ID: SupportedChainId = 46630;

export const CHAIN_META: Record<SupportedChainId, { short: string; dot: string }> = {
  46630: { short: "Robinhood", dot: "#CCFF00" },
  421614: { short: "Arbitrum", dot: "#28A0F0" },
};
