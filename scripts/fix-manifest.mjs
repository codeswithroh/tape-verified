// Rebuilds data/replay-<chain>.json from chain state: for each replay day, find when the deployer set
// that day's NVDA price (explorer tx history), then map every on-chain checkpoint to the latest day
// whose prices were set before it. Robust to seeder restarts that re-stamped a day.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import dotenv from "dotenv";
import { createPublicClient, http, parseAbi, decodeFunctionData } from "viem";

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(here, "..", ".env") });
const CHAIN = Number(process.env.CHAIN ?? 46630);
const EXPLORER = CHAIN === 46630 ? "https://explorer.testnet.chain.robinhood.com/api/v2" : "https://arbitrum-sepolia.blockscout.com/api/v2";
const dep = JSON.parse(readFileSync(join(here, "..", "contracts", "deployments", `${CHAIN}.json`), "utf8"));
const hist = JSON.parse(readFileSync(join(here, "data", "history.json"), "utf8"));
const manifestPath = join(here, "data", `replay-${CHAIN}.json`);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const pub = createPublicClient({ transport: http(CHAIN === 46630 ? process.env.RH_TESTNET_RPC : process.env.ARB_SEPOLIA_RPC) });
const feedAbi = parseAbi(["function update(int256)"]);
const engineAbi = parseAbi(["function count(address) view returns (uint256)", "function checkpointAt(address,uint256) view returns (uint256,uint256)"]);

const nvdaFeed = dep.assets.NVDA.feed.toLowerCase();
const priceToDay = new Map(hist.prices.NVDA.map((p, d) => [BigInt(Math.round(p * 1e8)), d]));

// 1. when was each day's NVDA price written?
const setAt = []; // [{ts, day}]
let params = "";
for (;;) {
  const r = await fetch(`${EXPLORER}/addresses/${dep.deployer}/transactions${params}`).then((x) => x.json());
  for (const t of r.items) {
    if (t.to?.hash?.toLowerCase() !== nvdaFeed || t.status !== "ok") continue;
    let args;
    try {
      ({ args } = decodeFunctionData({ abi: feedAbi, data: t.raw_input }));
    } catch {
      continue; // setUpdater and other admin calls
    }
    const day = priceToDay.get(args[0]);
    if (day !== undefined) setAt.push({ ts: Math.floor(new Date(t.timestamp).getTime() / 1000), day });
  }
  if (!r.next_page_params) break;
  params = "?" + new URLSearchParams(r.next_page_params).toString();
}
setAt.sort((a, b) => a.ts - b.ts);
console.log("price-set events", setAt.length, "first", setAt[0], "last", setAt.at(-1));

// 2. map checkpoints
for (const [vault, info] of Object.entries(manifest.vaults)) {
  const n = Number(await pub.readContract({ address: dep.engine, abi: engineAbi, functionName: "count", args: [vault] }));
  const dates = [];
  for (let i = 0; i < n; i++) {
    const [, ts] = await pub.readContract({ address: dep.engine, abi: engineAbi, functionName: "checkpointAt", args: [vault, BigInt(i)] });
    let day = null;
    for (const s of setAt) if (s.ts <= Number(ts)) day = s.day;
    dates.push(day === null ? hist.dates[0] : hist.dates[day]);
  }
  // checkpoints after the replay's last day are live stamps; leave them undated
  const lastReplay = dates.lastIndexOf(hist.dates.at(-1));
  info.dates = dates.slice(0, lastReplay + 1);
  const dupes = info.dates.length - new Set(info.dates).size;
  console.log(info.key, "checkpoints", n, "dated", info.dates.length, "duplicate-day stamps", dupes);
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
