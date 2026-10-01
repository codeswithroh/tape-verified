// Seeds demo vaults on a Tape testnet deployment by replaying real Robinhood Chain mainnet prices
// (data/history.json) one trading day per step. Managers trade their strategies through the real
// vault contracts; followers deposit and redeem; every day ends with an on-chain checkpoint.
// Writes data/replay-<chainId>.json mapping each vault's checkpoint index to its replayed date.
//
//   CHAIN=46630 node seed.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import dotenv from "dotenv";
import { createPublicClient, createWalletClient, http, parseAbi, keccak256, encodePacked, parseEther, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(here, "..", ".env") });

const CHAIN = Number(process.env.CHAIN ?? 46630);
const RPC = process.env.RPC ?? (CHAIN === 46630 ? process.env.RH_TESTNET_RPC : process.env.ARB_SEPOLIA_RPC);
const dep = JSON.parse(readFileSync(join(here, "..", "contracts", "deployments", `${CHAIN}.json`), "utf8"));
const hist = JSON.parse(readFileSync(join(here, "data", "history.json"), "utf8"));
const chain = {
  id: CHAIN, name: String(CHAIN), nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } }, contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
};
const pub = createPublicClient({ chain, pollingInterval: 250, transport: http(RPC, { retryCount: 6, retryDelay: 1000 }) });

const A = {
  erc20: parseAbi(["function approve(address,uint256) returns (bool)", "function faucet()", "function balanceOf(address) view returns (uint256)", "function transfer(address,uint256) returns (bool)"]),
  feed: parseAbi(["function update(int256)"]),
  reg: parseAbi(["function setParams(uint256,uint256)"]),
  factory: parseAbi(["function createVault(string,string,address[],uint16,uint256) returns (address)", "function vaultsOf(address) view returns (address[])"]),
  vault: parseAbi([
    "function deposit(uint256,uint256,address) returns (uint256)",
    "function redeem(uint256,address) returns (uint256, uint256[])",
    "function trade(address,address,uint256,uint256) returns (uint256)",
    "function checkpoint() returns (uint256)",
    "function holdings() view returns (address[], uint256[])",
    "function balanceOf(address) view returns (uint256)",
  ]),
  engine: parseAbi(["function count(address) view returns (uint256)"]),
};

const deployer = privateKeyToAccount(process.env.PRIVATE_KEY);
const derive = (label) => privateKeyToAccount(keccak256(encodePacked(["bytes32", "string"], [process.env.PRIVATE_KEY, `tape-seed:${label}`])));
const wallet = (acct) => createWalletClient({ account: acct, chain, pollingInterval: 250, transport: http(RPC, { retryCount: 6, retryDelay: 1000 }) });

// Fixed gas/fees: one RPC round trip per tx instead of five (estimate, fees, priority, chain id).
const FEES = { maxFeePerGas: 100_000_000n, maxPriorityFeePerGas: 0n };
const nonces = new Map();
async function nextNonce(acct) {
  if (!nonces.has(acct.address)) nonces.set(acct.address, await pub.getTransactionCount({ address: acct.address, blockTag: "pending" }));
  const n = nonces.get(acct.address);
  nonces.set(acct.address, n + 1);
  return n;
}
async function send(acct, address, abi, functionName, args = []) {
  const gas = functionName === "createVault" ? 4_000_000n : 900_000n;
  const nonce = await nextNonce(acct);
  let hash;
  try {
    hash = await wallet(acct).writeContract({ address, abi, functionName, args, gas, nonce, ...FEES });
  } catch (e) {
    nonces.delete(acct.address);
    throw e;
  }
  const r = await pub.waitForTransactionReceipt({ hash, timeout: 120_000 });
  if (r.status !== "success") throw new Error(`${functionName} reverted ${hash}`);
  return r;
}

const tok = (s) => dep.assets[s].token;
const price = (s, d) => hist.prices[s][d];

// ------------------------------------------------------------------ personas
const STRATS = [
  {
    key: "semis", name: "Semis Momentum", symbol: "tSEMI", fee: 2000, seed: 3_000, assets: ["NVDA", "AMD", "PLTR", "QQQ"],
    target(d) {
      if (d % 5 !== 0) return null;
      const lb = Math.max(0, d - 10);
      const mom = ["NVDA", "AMD", "PLTR"].map((s) => [s, price(s, d) / price(s, lb) - 1]).sort((a, b) => b[1] - a[1]);
      if (mom[0][1] < 0) return { QQQ: 0.5 };
      return { [mom[0][0]]: 0.45, [mom[1][0]]: 0.45 };
    },
  },
  {
    key: "index", name: "Index Steady", symbol: "tIDX", fee: 1000, seed: 5_000, assets: ["SPY", "QQQ"],
    target: (d) => (d % 10 === 0 ? { SPY: 0.59, QQQ: 0.39 } : null),
  },
  {
    key: "mag7", name: "Mag 7 Equal Weight", symbol: "tMAG7", fee: 1500, seed: 4_000,
    assets: ["AAPL", "MSFT", "META", "AMZN", "GOOGL", "NVDA", "TSLA"],
    target: (d) => (d % 10 === 0 ? Object.fromEntries(["AAPL", "MSFT", "META", "AMZN", "GOOGL", "NVDA", "TSLA"].map((s) => [s, 0.14])) : null),
  },
  {
    key: "yolo", name: "Tesla Maxi", symbol: "tYOLO", fee: 3000, seed: 2_000, assets: ["TSLA", "PLTR"],
    target(d) {
      if (d === 0) return { TSLA: 0.7, PLTR: 0.28 };
      if (d % 2 !== 0) return null;
      const r = price("TSLA", d) / price("TSLA", d - 2) - 1; // buys the dip, chases nothing
      return r < 0 ? { TSLA: 0.95, PLTR: 0.04 } : { TSLA: 0.55, PLTR: 0.4 };
    },
  },
];
const FOLLOWS = [
  { key: "f1", day: 8, vault: "semis", usdg: 8_000 },
  { key: "f2", day: 4, vault: "index", usdg: 6_000 },
  { key: "f2", day: 30, vault: "mag7", usdg: 3_000 },
  { key: "f3", day: 14, vault: "yolo", usdg: 5_000 },
  { key: "f1", day: 40, vault: "mag7", usdg: 4_000 },
  { key: "f3", day: 52, vault: "yolo", redeemFrac: 0.6 },
  { key: "f2", day: 60, vault: "semis", usdg: 2_500 },
];

// ------------------------------------------------------------------ helpers
const USDG = dep.usdg;
const usd = (n) => BigInt(Math.round(n * 1e6));

async function faucetTo(acct, amount) {
  const have = Number(await pub.readContract({ address: USDG, abi: A.erc20, functionName: "balanceOf", args: [acct.address] })) / 1e6;
  for (let h = have; h < amount; h += 10_000) await send(acct, USDG, A.erc20, "faucet");
}

async function rebalance(acct, vault, target, d) {
  const [tokens, bals] = await pub.readContract({ address: vault, abi: A.vault, functionName: "holdings" });
  const sym = Object.fromEntries(Object.entries(dep.assets).map(([s, a]) => [a.token.toLowerCase(), s]));
  let cash = Number(bals[0]) / 1e6;
  const pos = {};
  let value = cash;
  for (let i = 1; i < tokens.length; i++) {
    const s = sym[tokens[i].toLowerCase()];
    const v = (Number(bals[i]) / 1e18) * price(s, d);
    pos[s] = { bal: bals[i], v };
    value += v;
  }
  const trades = [];
  for (const s of Object.keys(pos)) {
    const diff = (target[s] ?? 0) * value - pos[s].v;
    if (diff < -25) {
      const frac = Math.min(1, -diff / pos[s].v);
      const amt = frac > 0.995 ? pos[s].bal : (pos[s].bal * BigInt(Math.floor(frac * 1e6))) / 1_000_000n;
      if (amt > 0n) trades.push(["sell", s, amt]);
      cash += -diff * 0.997;
    }
  }
  for (const [s, w] of Object.entries(target)) {
    const diff = w * value - (pos[s]?.v ?? 0);
    if (diff > 25) {
      const spend = Math.min(diff, cash - 1);
      if (spend > 25) { trades.push(["buy", s, usd(spend)]); cash -= spend; }
    }
  }
  for (const [side, s, amt] of trades) {
    await send(acct, vault, A.vault, "trade", side === "buy" ? [USDG, tok(s), amt, 50n] : [tok(s), USDG, amt, 50n]);
  }
  return trades.length;
}

// ------------------------------------------------------------------ run
const D = Math.min(hist.dates.length, Number(process.env.DAYS ?? Infinity));
console.log(`seeding chain ${CHAIN}: ${D} days ${hist.dates[0]}..${hist.dates.at(-1)}`);

const managers = Object.fromEntries(STRATS.map((s) => [s.key, derive(s.key)]));
const followers = Object.fromEntries(["f1", "f2", "f3"].map((k) => [k, derive(k)]));
const gas = CHAIN === 46630 ? parseEther("0.0009") : parseEther("0.004");
for (const acct of [...Object.values(managers), ...Object.values(followers)]) {
  const bal = await pub.getBalance({ address: acct.address });
  if (bal < gas / 2n) {
    const hash = await wallet(deployer).sendTransaction({ to: acct.address, value: gas, nonce: await nextNonce(deployer), gas: 50_000n, ...FEES });
    await pub.waitForTransactionReceipt({ hash });
  }
}
console.log("funded", Object.keys(managers).length + Object.keys(followers).length, "accounts");

await send(deployer, dep.registry, A.reg, "setParams", [26n * 3600n, 0n]);

async function setPrices(d) {
  // pipeline feed updates with explicit nonces, then wait for the last one
  // Arbitrum sequencers have no mempool: a nonce gap is rejected, so submit strictly in order.
  const hashes = [];
  try {
    for (const [s, a] of Object.entries(dep.assets)) {
      hashes.push(await wallet(deployer).writeContract({ address: a.feed, abi: A.feed, functionName: "update", args: [BigInt(Math.round(price(s, d) * 1e8))], nonce: await nextNonce(deployer), gas: 120_000n, ...FEES }));
    }
  } catch (e) {
    nonces.delete(deployer.address);
    throw e;
  }
  for (const h of hashes) await pub.waitForTransactionReceipt({ hash: h, timeout: 120_000 });
}

const vaults = {};
const manifestPath = join(here, "data", `replay-${CHAIN}.json`);
let manifest = { chainId: CHAIN, source: hist.source, vaults: {} };
let startDay = 0;
try {
  const prev = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (Object.keys(prev.vaults).length === STRATS.length) {
    manifest = prev;
    for (const [v, info] of Object.entries(prev.vaults)) vaults[info.key] = v;
    // last fully recorded day = min checkpoints across vaults
    startDay = Math.min(...Object.values(prev.vaults).map((x) => x.dates.length));
    for (const [v, info] of Object.entries(prev.vaults)) {
      const onchain = Number(await pub.readContract({ address: dep.engine, abi: A.engine, functionName: "count", args: [v] }));
      info.dates = info.dates.slice(0, onchain);
      startDay = Math.min(startDay, onchain);
    }
    console.log("resuming at day", startDay);
  }
} catch {}
try {
  if (startDay === 0) await setPrices(0);
  for (const s of startDay === 0 ? STRATS : []) {
    const m = managers[s.key];
    const existing = await pub.readContract({ address: dep.factory, abi: A.factory, functionName: "vaultsOf", args: [m.address] });
    if (existing.length) throw new Error(`${s.key} already seeded at ${existing[0]}; refusing to double-seed`);
    await faucetTo(m, s.seed);
    await send(m, USDG, A.erc20, "approve", [dep.factory, usd(s.seed)]);
    await send(m, dep.factory, A.factory, "createVault", [s.name, s.symbol, s.assets.map(tok), s.fee, usd(s.seed)]);
    const [v] = await pub.readContract({ address: dep.factory, abi: A.factory, functionName: "vaultsOf", args: [m.address] });
    vaults[s.key] = v;
    manifest.vaults[v] = { key: s.key, manager: m.address, dates: [hist.dates[0]] };
    console.log(`${s.name.padEnd(20)} ${v}`);
  }

  for (let d = startDay; d < D; d++) {
    if (d > 0) await setPrices(d);
    for (const f of FOLLOWS.filter((f) => f.day === d)) {
      const acct = followers[f.key];
      const v = vaults[f.vault];
      if (f.usdg) {
        await faucetTo(acct, f.usdg);
        await send(acct, USDG, A.erc20, "approve", [v, usd(f.usdg)]);
        await send(acct, v, A.vault, "deposit", [usd(f.usdg), 1n, acct.address]);
      } else {
        const sh = await pub.readContract({ address: v, abi: A.vault, functionName: "balanceOf", args: [acct.address] });
        await send(acct, v, A.vault, "redeem", [(sh * BigInt(Math.round(f.redeemFrac * 1000))) / 1000n, acct.address]);
      }
    }
    const n = await Promise.all(
      STRATS.map(async (s) => {
        const m = managers[s.key];
        const t = manifest.vaults[vaults[s.key]].dates.length > d ? null : s.target(d);
        const k = t ? await rebalance(m, vaults[s.key], t, d) : 0;
        if (d > 0 && manifest.vaults[vaults[s.key]].dates.length <= d) {
          await send(m, vaults[s.key], A.vault, "checkpoint");
          manifest.vaults[vaults[s.key]].dates.push(hist.dates[d]);
        }
        return k;
      }),
    );
    console.log(`day ${String(d).padStart(2)} ${hist.dates[d]} trades ${n.join("/")}`);
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
  }
} finally {
  await send(deployer, dep.registry, A.reg, "setParams", [26n * 3600n, 60n]);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
  console.log("deployer ETH left", formatEther(await pub.getBalance({ address: deployer.address })));
}
