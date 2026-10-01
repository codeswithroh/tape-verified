// Price relay: mirrors Robinhood Chain *mainnet* Chainlink stock feeds into the Tape testnet
// MockAggregators, so testnet portfolios are valued at real market prices.
//
//   node relay.mjs            # loop forever (INTERVAL_SEC, default 300)
//   node relay.mjs --once     # single pass
//
// MODE=heartbeat (default): write the mainnet answer with the current timestamp whenever the
//   testnet feed is older than HEARTBEAT_SEC or the price changed. Keeps the demo usable on weekends.
// MODE=mirror: also copy mainnet's updatedAt, so testnet staleness behaves exactly like mainnet
//   (deposits and trades halt when the market is closed).
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import dotenv from "dotenv";
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(here, "..", ".env") });

const MODE = process.env.MODE ?? "heartbeat";
const INTERVAL_SEC = Number(process.env.INTERVAL_SEC ?? 300);
const HEARTBEAT_SEC = Number(process.env.HEARTBEAT_SEC ?? 6 * 3600);
const ONCE = process.argv.includes("--once");

const feedAbi = parseAbi([
  "function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)",
  "function update(int256 answer)",
  "function updateAt(int256 answer, uint256 updatedAt)",
]);

const targets = [
  { name: "robinhood-testnet", chainId: 46630, rpc: process.env.RH_TESTNET_RPC },
  { name: "arbitrum-sepolia", chainId: 421614, rpc: process.env.ARB_SEPOLIA_RPC },
]
  .map((t) => ({ ...t, file: join(here, "..", "contracts", "deployments", `${t.chainId}.json`) }))
  .filter((t) => t.rpc && existsSync(t.file));

const account = privateKeyToAccount(process.env.PRIVATE_KEY);
const mainnet = createPublicClient({ transport: http(process.env.RH_MAINNET_RPC) });

const chainFor = (id, rpc) => ({
  id,
  name: String(id),
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
});

async function readFeed(client, address) {
  const [, answer, , updatedAt] = await client.readContract({ address, abi: feedAbi, functionName: "latestRoundData" });
  return { answer, updatedAt };
}

async function pass() {
  for (const t of targets) {
    const dep = JSON.parse(readFileSync(t.file, "utf8"));
    const chain = chainFor(t.chainId, t.rpc);
    const pub = createPublicClient({ chain, transport: http(t.rpc) });
    const wallet = createWalletClient({ account, chain, transport: http(t.rpc) });
    const now = BigInt(Math.floor(Date.now() / 1000));

    for (const [symbol, a] of Object.entries(dep.assets)) {
      try {
        const src = await readFeed(mainnet, a.mainnetFeed);
        const dst = await readFeed(pub, a.feed);
        const changed = src.answer !== dst.answer;
        const old = now - dst.updatedAt > BigInt(HEARTBEAT_SEC);
        const behind = src.updatedAt > dst.updatedAt;
        if (MODE === "mirror" ? !(changed || behind) : !(changed || old)) continue;

        const hash =
          MODE === "mirror"
            ? await wallet.writeContract({ address: a.feed, abi: feedAbi, functionName: "updateAt", args: [src.answer, src.updatedAt] })
            : await wallet.writeContract({ address: a.feed, abi: feedAbi, functionName: "update", args: [src.answer] });
        await pub.waitForTransactionReceipt({ hash });
        console.log(`[${t.name}] ${symbol.padEnd(5)} ${(Number(src.answer) / 1e8).toFixed(2).padStart(9)}  ${hash}`);
      } catch (e) {
        console.error(`[${t.name}] ${symbol}: ${e.shortMessage ?? e.message}`);
      }
    }
  }
}

console.log(`relay mode=${MODE} targets=${targets.map((t) => t.name).join(",")} as ${account.address}`);
do {
  await pass();
  if (!ONCE) await new Promise((r) => setTimeout(r, INTERVAL_SEC * 1000));
} while (!ONCE);
