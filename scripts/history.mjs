// Pulls every round of the Robinhood Chain mainnet Chainlink stock feeds and reduces them to one
// close per US trading day (last answer before 20:00 UTC). Output: data/history.json
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import dotenv from "dotenv";
import { createPublicClient, http, parseAbi } from "viem";

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(here, "..", ".env") });

const abi = parseAbi([
  "function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)",
  "function getRoundData(uint80) view returns (uint80, int256, uint256, uint256, uint80)",
]);
const client = createPublicClient({
  chain: { id: 4663, name: "rh", nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [process.env.RH_MAINNET_RPC] } }, contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } } },
  transport: http(process.env.RH_MAINNET_RPC, { retryCount: 5, retryDelay: 800 }),
});

const dep = JSON.parse(readFileSync(join(here, "..", "contracts", "deployments", "46630.json"), "utf8"));
const PHASE = 1n << 64n;

async function rounds(feed) {
  const [latest] = await client.readContract({ address: feed, abi, functionName: "latestRoundData" });
  const phase = latest / PHASE;
  const last = latest % PHASE;
  const out = [];
  const CHUNK = 250n;
  for (let start = 1n; start <= last; start += CHUNK) {
    const ids = [];
    for (let i = start; i < start + CHUNK && i <= last; i++) ids.push(phase * PHASE + i);
    const res = await client.multicall({
      contracts: ids.map((id) => ({ address: feed, abi, functionName: "getRoundData", args: [id] })),
      allowFailure: true,
    });
    for (const r of res) {
      if (r.status !== "success") continue;
      const [, answer, , updatedAt] = r.result;
      if (answer <= 0n || answer > 10n ** 14n) continue; // early rounds of phase 1 used a different scale
      out.push({ t: Number(updatedAt), p: Number(answer) / 1e8 });
    }
  }
  return out;
}

const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const series = {};
for (const [sym, a] of Object.entries(dep.assets)) {
  const rs = await rounds(a.mainnetFeed);
  const closes = {};
  for (const r of rs) {
    const d = new Date(r.t * 1000);
    const wd = d.getUTCDay();
    if (wd === 0 || wd === 6) continue;
    if (d.getUTCHours() >= 20) continue; // after the US close; belongs to the overnight session
    closes[day(r.t)] = r.p; // rounds are ascending, so the last write is the close
  }
  series[sym] = closes;
  console.log(sym, rs.length, "rounds,", Object.keys(closes).length, "days");
}

// trading days where every asset has a close
const all = Object.values(series);
const dates = Object.keys(all[0]).filter((d) => all.every((s) => s[d] !== undefined)).sort();
const prices = Object.fromEntries(Object.entries(series).map(([s, c]) => [s, dates.map((d) => c[d])]));
mkdirSync(join(here, "data"), { recursive: true });
writeFileSync(join(here, "data", "history.json"), JSON.stringify({ source: "Robinhood Chain mainnet Chainlink", dates, prices }, null, 1));
console.log(`${dates.length} common trading days ${dates[0]} .. ${dates.at(-1)}`);
