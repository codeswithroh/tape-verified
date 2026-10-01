import { parseAbi, type Address } from "viem";
import dep46630 from "@/config/deployment-46630.json";
import dep421614 from "@/config/deployment-421614.json";
import rep46630 from "@/config/replay-46630.json";
import rep421614 from "@/config/replay-421614.json";
import type { SupportedChainId } from "./chains";

export type AssetInfo = { token: Address; feed: Address; mainnetFeed: Address };
export type Deployment = {
  chainId: number;
  usdg: Address;
  router: Address;
  registry: Address;
  engine: Address;
  factory: Address;
  stylusEngine: boolean;
  assets: Record<string, AssetInfo>;
};
export type Replay = { chainId: number; source: string; vaults: Record<string, { key: string; manager: Address; dates: string[] }> };

export const DEPLOYMENTS: Record<SupportedChainId, Deployment> = {
  46630: dep46630 as Deployment,
  421614: dep421614 as Deployment,
};
export const REPLAYS: Record<SupportedChainId, Replay> = {
  46630: rep46630 as Replay,
  421614: rep421614 as Replay,
};

/** Smoke-test vaults created during deployment checks; not shown in the app. */
export const HIDDEN_VAULTS = new Set(["0x30f6f71b6dfe91dca216f29ae6d0affae097a4f9"]);

export const DEPLOY_BLOCK: Record<SupportedChainId, bigint> = { 46630: 127106419n, 421614: 314616732n };

export const ASSET_META: Record<string, { name: string; color: string }> = {
  NVDA: { name: "NVIDIA", color: "#76B900" },
  AAPL: { name: "Apple", color: "#C9C9C9" },
  TSLA: { name: "Tesla", color: "#E82127" },
  MSFT: { name: "Microsoft", color: "#00A4EF" },
  META: { name: "Meta", color: "#0866FF" },
  AMZN: { name: "Amazon", color: "#FF9900" },
  GOOGL: { name: "Alphabet", color: "#34A853" },
  SPY: { name: "S&P 500 ETF", color: "#B39DDB" },
  QQQ: { name: "Nasdaq-100 ETF", color: "#26C6DA" },
  PLTR: { name: "Palantir", color: "#F5F5F5" },
  AMD: { name: "AMD", color: "#ED1C24" },
  USDG: { name: "Global Dollar", color: "#FF6A2B" },
};

export const abi = {
  erc20: parseAbi([
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address,address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)",
    "function faucet()",
    "function decimals() view returns (uint8)",
  ]),
  feed: parseAbi(["function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)"]),
  factory: parseAbi([
    "function vaults() view returns (address[])",
    "function vaultsOf(address) view returns (address[])",
    "function createVault(string,string,address[],uint16,uint256) returns (address)",
    "event VaultCreated(address indexed vault, address indexed manager, string name, uint16 perfFeeBps, uint256 seed)",
  ]),
  vault: parseAbi([
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function manager() view returns (address)",
    "function perfFeeBps() view returns (uint16)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function totalValue() view returns (uint256)",
    "function pricePerShare() view returns (uint256)",
    "function highWaterMark() view returns (uint256)",
    "function lastCheckpoint() view returns (uint256)",
    "function assets() view returns (address[])",
    "function holdings() view returns (address[], uint256[])",
    "function deposit(uint256 usdgIn, uint256 minShares, address receiver) returns (uint256)",
    "function redeem(uint256 shares, address receiver) returns (uint256, uint256[])",
    "function trade(address tokenIn, address tokenOut, uint256 amountIn, uint256 maxDevBps) returns (uint256)",
    "function checkpoint() returns (uint256)",
    "event Deposited(address indexed caller, address indexed receiver, uint256 usdgIn, uint256 shares)",
    "event Redeemed(address indexed owner, address indexed receiver, uint256 shares)",
    "event Traded(address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut, uint256 oracleOut)",
    "event Checkpointed(uint256 indexed index, uint256 pps, uint256 totalValue)",
    "error StalePrice(address token)",
    "error SlippageExceeded(uint256 out, uint256 minOut)",
    "error InsufficientShares(uint256 shares, uint256 minShares)",
    "error NotManager()",
    "error CheckpointTooSoon()",
    "error DeviationTooHigh()",
    "error BadAsset(address token)",
  ]),
  engine: parseAbi([
    "function count(address) view returns (uint256)",
    "function checkpointAt(address, uint256) view returns (uint256, uint256)",
    "function metrics(address) view returns (uint256, uint256, uint256, uint256, uint256, uint256)",
  ]),
  registry: parseAbi(["function listedTokens() view returns (address[])"]),
};
