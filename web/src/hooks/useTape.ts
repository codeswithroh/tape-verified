"use client";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { useNetwork } from "@/components/Providers";
import { publicClient } from "@/lib/wagmi";
import { abi, DEPLOYMENTS, REPLAYS, HIDDEN_VAULTS, DEPLOY_BLOCK } from "@/lib/contracts";
import { signedWad, wad, usdg } from "@/lib/format";
import type { SupportedChainId } from "@/lib/chains";

export type Price = { price: number; updatedAt: number };
export type Holding = { sym: string; token: Address; amount: number; value: number; weight: number };
export type Point = { i: number; pps: number; ts: number; date?: string };
export type Metrics = { n: number; totalReturn: number; maxDrawdown: number; volatility: number; sharpe: number; elapsed: number };
export type Vault = {
  address: Address;
  name: string;
  symbol: string;
  manager: Address;
  feeBps: number;
  supply: number;
  value: number;
  pps: number;
  hwm: number;
  lastCheckpoint: number;
  assets: string[];
  holdings: Holding[];
  metrics: Metrics;
  series: Point[];
  replay: boolean;
  /** annualised from per-checkpoint stats, assuming daily checkpoints */
  sharpeAnn: number;
  volAnn: number;
};

function symbolMap(chainId: SupportedChainId) {
  const d = DEPLOYMENTS[chainId];
  const m: Record<string, string> = { [d.usdg.toLowerCase()]: "USDG" };
  for (const [s, a] of Object.entries(d.assets)) m[a.token.toLowerCase()] = s;
  return m;
}

export async function fetchPrices(chainId: SupportedChainId): Promise<Record<string, Price>> {
  const d = DEPLOYMENTS[chainId];
  const syms = Object.keys(d.assets);
  const res = await publicClient(chainId).multicall({
    contracts: syms.map((s) => ({ address: d.assets[s].feed, abi: abi.feed, functionName: "latestRoundData" as const })),
  });
  const out: Record<string, Price> = { USDG: { price: 1, updatedAt: Date.now() / 1000 } };
  res.forEach((r, i) => {
    if (r.status === "success") {
      const [, answer, , updatedAt] = r.result as readonly [bigint, bigint, bigint, bigint, bigint];
      out[syms[i]] = { price: Number(answer) / 1e8, updatedAt: Number(updatedAt) };
    }
  });
  return out;
}

async function fetchVaults(chainId: SupportedChainId): Promise<{ vaults: Vault[]; prices: Record<string, Price> }> {
  const d = DEPLOYMENTS[chainId];
  const pc = publicClient(chainId);
  const syms = symbolMap(chainId);
  const replay = REPLAYS[chainId];

  const [all, prices] = await Promise.all([
    pc.readContract({ address: d.factory, abi: abi.factory, functionName: "vaults" }),
    fetchPrices(chainId),
  ]);
  const list = (all as Address[]).filter((v) => !HIDDEN_VAULTS.has(v.toLowerCase()));
  if (!list.length) return { vaults: [], prices };

  const fns = ["name", "symbol", "manager", "perfFeeBps", "totalSupply", "highWaterMark", "lastCheckpoint", "assets", "holdings"] as const;
  const calls = list.flatMap((v) => [
    ...fns.map((f) => ({ address: v, abi: abi.vault, functionName: f })),
    { address: d.engine, abi: abi.engine, functionName: "count", args: [v] },
    { address: d.engine, abi: abi.engine, functionName: "metrics", args: [v] },
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await pc.multicall({ contracts: calls as any, allowFailure: true });
  const per = fns.length + 2;

  const counts = list.map((_, k) => Number((res[k * per + fns.length].result as bigint) ?? 0n));
  const cpCalls = list.flatMap((v, k) =>
    Array.from({ length: counts[k] }, (_, i) => ({ address: d.engine, abi: abi.engine, functionName: "checkpointAt" as const, args: [v, BigInt(i)] as const })),
  );
  const cps = cpCalls.length ? await pc.multicall({ contracts: cpCalls, allowFailure: true }) : [];

  let cursor = 0;
  const vaults = list.map((address, k) => {
    const r = (j: number) => res[k * per + j].result;
    const [tokens, bals] = (r(8) as [Address[], bigint[]]) ?? [[], []];
    const raw = tokens.map((t, i) => {
      const sym = syms[t.toLowerCase()] ?? "?";
      const amount = sym === "USDG" ? usdg(bals[i]) : wad(bals[i]);
      return { sym, token: t, amount, value: amount * (prices[sym]?.price ?? 0) };
    });
    const value = raw.reduce((a, h) => a + h.value, 0);
    const holdings = raw.map((h) => ({ ...h, weight: value ? h.value / value : 0 }));
    const supply = wad((r(4) as bigint) ?? 0n);
    const m = (r(10) as bigint[]) ?? [0n, 0n, 0n, 0n, 0n, 0n];
    const metrics: Metrics = {
      n: Number(m[0]),
      totalReturn: signedWad(m[1]),
      maxDrawdown: wad(m[2]),
      volatility: wad(m[3]),
      sharpe: signedWad(m[4]),
      elapsed: Number(m[5]),
    };
    const rep = replay.vaults[address] ?? replay.vaults[address.toLowerCase()];
    const series: Point[] = [];
    for (let i = 0; i < counts[k]; i++) {
      const c = cps[cursor++];
      if (c?.status !== "success") continue;
      const [pps, ts] = c.result as readonly [bigint, bigint];
      series.push({ i, pps: wad(pps), ts: Number(ts), date: rep?.dates[i] });
    }
    return {
      address,
      name: (r(0) as string) ?? "Vault",
      symbol: (r(1) as string) ?? "",
      manager: r(2) as Address,
      feeBps: Number(r(3) ?? 0),
      supply,
      value,
      pps: supply ? value / supply : 1,
      hwm: wad((r(5) as bigint) ?? 0n),
      lastCheckpoint: Number(r(6) ?? 0),
      assets: ((r(7) as Address[]) ?? []).map((t) => syms[t.toLowerCase()] ?? "?"),
      holdings,
      metrics,
      series,
      replay: !!rep,
      sharpeAnn: metrics.sharpe * Math.sqrt(252),
      volAnn: metrics.volatility * Math.sqrt(252),
    } satisfies Vault;
  });
  return { vaults, prices };
}

export function useVaults() {
  const { chainId } = useNetwork();
  return useQuery({ queryKey: ["vaults", chainId], queryFn: () => fetchVaults(chainId), refetchInterval: 30_000 });
}

export function useVault(address?: string) {
  const q = useVaults();
  const vault = q.data?.vaults.find((v) => v.address.toLowerCase() === address?.toLowerCase());
  return { ...q, vault, prices: q.data?.prices };
}

export function usePrices() {
  const { chainId } = useNetwork();
  return useQuery({ queryKey: ["prices", chainId], queryFn: () => fetchPrices(chainId), refetchInterval: 30_000 });
}

export type Activity =
  | { kind: "trade"; block: bigint; tx: string; tokenIn: string; tokenOut: string; amountIn: number; amountOut: number; slippageBps: number }
  | { kind: "deposit"; block: bigint; tx: string; who: Address; usdg: number }
  | { kind: "redeem"; block: bigint; tx: string; who: Address; shares: number };

async function getLogsChunked(chainId: SupportedChainId, params: Parameters<ReturnType<typeof publicClient>["getLogs"]>[0]) {
  const pc = publicClient(chainId);
  const head = await pc.getBlockNumber();
  const step = 2_000_000n;
  const out = [];
  for (let from = DEPLOY_BLOCK[chainId]; from <= head; from += step) {
    const to = from + step - 1n > head ? head : from + step - 1n;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    out.push(...(await pc.getLogs({ ...(params as any), fromBlock: from, toBlock: to })));
  }
  return out;
}

export function useActivity(vault?: Address) {
  const { chainId } = useNetwork();
  return useQuery({
    enabled: !!vault,
    queryKey: ["activity", chainId, vault],
    queryFn: async () => {
      const syms = symbolMap(chainId);
      const events = abi.vault.filter((x) => x.type === "event");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const logs: any[] = await getLogsChunked(chainId, { address: vault, events } as any);
      const acts: Activity[] = logs
        .map((l): Activity | null => {
          const a = l.args;
          if (l.eventName === "Traded") {
            const inSym = syms[a.tokenIn.toLowerCase()];
            const outSym = syms[a.tokenOut.toLowerCase()];
            const conv = (s: string, x: bigint) => (s === "USDG" ? usdg(x) : wad(x));
            const out = conv(outSym, a.amountOut);
            const orc = conv(outSym, a.oracleOut);
            return { kind: "trade", block: l.blockNumber, tx: l.transactionHash, tokenIn: inSym, tokenOut: outSym, amountIn: conv(inSym, a.amountIn), amountOut: out, slippageBps: orc ? ((orc - out) / orc) * 1e4 : 0 };
          }
          if (l.eventName === "Deposited") return { kind: "deposit", block: l.blockNumber, tx: l.transactionHash, who: a.receiver, usdg: usdg(a.usdgIn) };
          if (l.eventName === "Redeemed") return { kind: "redeem", block: l.blockNumber, tx: l.transactionHash, who: a.owner, shares: wad(a.shares) };
          return null;
        })
        .filter(Boolean) as Activity[];
      return acts.sort((x, y) => Number(y.block - x.block));
    },
  });
}

/** Unique depositors per vault, for "copiers" counts. */
export function useCopiers() {
  const { chainId } = useNetwork();
  const { data } = useVaults();
  const addrs = data?.vaults.map((v) => v.address) ?? [];
  return useQuery({
    enabled: addrs.length > 0,
    queryKey: ["copiers", chainId, addrs.join()],
    queryFn: async () => {
      const ev = abi.vault.find((x) => x.type === "event" && x.name === "Deposited");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const logs: any[] = await getLogsChunked(chainId, { address: addrs, event: ev } as any);
      const mgr = Object.fromEntries((data?.vaults ?? []).map((v) => [v.address.toLowerCase(), v.manager.toLowerCase()]));
      const m: Record<string, Set<string>> = {};
      for (const l of logs) {
        const v = l.address.toLowerCase();
        const who = l.args.receiver.toLowerCase();
        if (who !== mgr[v]) (m[v] ??= new Set()).add(who);
      }
      return Object.fromEntries(Object.entries(m).map(([k, s]) => [k, s.size]));
    },
  });
}

export type Position = { vault: Vault; shares: number; value: number; share: number; cost: number };

/** The connected wallet's stake in every vault, with USDG cost basis from deposit events. */
export function usePositions(user?: Address) {
  const { chainId } = useNetwork();
  const { data } = useVaults();
  const vs = data?.vaults ?? [];
  return useQuery({
    enabled: !!user && vs.length > 0,
    queryKey: ["positions", chainId, user, vs.map((v) => v.address).join()],
    queryFn: async (): Promise<Position[]> => {
      const pc = publicClient(chainId);
      const bals = await pc.multicall({ contracts: vs.map((v) => ({ address: v.address, abi: abi.vault, functionName: "balanceOf" as const, args: [user!] as const })) });
      // Average-cost basis: replay this wallet's deposits and redemptions in order; a redemption of
      // x% of shares removes x% of the remaining cost.
      const dep = abi.vault.find((x) => x.type === "event" && x.name === "Deposited");
      const red = abi.vault.find((x) => x.type === "event" && x.name === "Redeemed");
      const addrs = vs.map((v) => v.address);
      const [ins, outs] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getLogsChunked(chainId, { address: addrs, event: dep, args: { receiver: user } } as any),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getLogsChunked(chainId, { address: addrs, event: red, args: { owner: user } } as any),
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events = ([...ins, ...outs] as any[]).sort((x, y) => (x.blockNumber === y.blockNumber ? x.logIndex - y.logIndex : Number(x.blockNumber - y.blockNumber)));
      const book: Record<string, { shares: number; cost: number }> = {};
      for (const l of events) {
        const k = l.address.toLowerCase();
        const b = (book[k] ??= { shares: 0, cost: 0 });
        if (l.eventName === "Deposited") {
          b.shares += wad(l.args.shares);
          b.cost += usdg(l.args.usdgIn);
        } else {
          const s = wad(l.args.shares);
          b.cost -= b.shares ? b.cost * Math.min(1, s / b.shares) : 0;
          b.shares -= s;
        }
      }
      const cost = Object.fromEntries(Object.entries(book).map(([k, b]) => [k, b.cost]));
      return vs
        .map((v, i) => {
          const shares = wad((bals[i].result as bigint) ?? 0n);
          const share = v.supply ? shares / v.supply : 0;
          return { vault: v, shares, share, value: share * v.value, cost: cost[v.address.toLowerCase()] ?? 0 };
        })
        .filter((p) => p.shares > 0);
    },
  });
}
