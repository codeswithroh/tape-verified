"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { ArrowDownUp, Loader2, Plus, Stamp, SlidersHorizontal, Check } from "lucide-react";
import { useVaults, type Vault } from "@/hooks/useTape";
import { useNetwork } from "@/components/Providers";
import { useTxFlow } from "@/hooks/useTx";
import { ConnectButton, useEnsureChain } from "@/components/app/Wallet";
import { EquityChart } from "@/components/charts/EquityChart";
import { AssetGlyph } from "@/components/ui/AssetChip";
import { Identicon } from "@/components/ui/Identicon";
import { Label, Panel, Skeleton } from "@/components/ui/bits";
import { abi, DEPLOYMENTS } from "@/lib/contracts";
import { fmtNum, fmtPct, fmtUsd, tone } from "@/lib/format";
import { useNow } from "@/hooks/useClient";

const SPREAD = 0.0025; // testnet venue spread; mainnet NVDA/USDG measured 24-53 bps

function TradeTicket({ v }: { v: Vault }) {
  const { chainId } = useNetwork();
  const dep = DEPLOYMENTS[chainId];
  const ensure = useEnsureChain();
  const { writeContractAsync } = useWriteContract();
  const flow = useTxFlow();
  const [sym, setSym] = useState(v.assets[0]);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [band, setBand] = useState(50);
  const now = useNow(10_000);

  const h = v.holdings.find((x) => x.sym === sym);
  const cash = v.holdings.find((x) => x.sym === "USDG");
  const px = h && h.amount ? h.value / h.amount : 0;
  const { data } = useVaults();
  const price = px || (data?.prices[sym]?.price ?? 0);
  const stale = data?.prices[sym] ? now - data.prices[sym].updatedAt > 26 * 3600 : false;
  const amt = Number(amount) || 0;
  const oracleOut = side === "buy" ? amt / (price || 1) : amt * price;
  const expected = oracleOut * (1 - SPREAD);
  const floor = oracleOut * (1 - band / 1e4);
  const maxIn = side === "buy" ? cash?.amount ?? 0 : h?.amount ?? 0;
  const ok = amt > 0 && amt <= maxIn + 1e-9 && expected >= floor && !stale;

  async function submit() {
    const token = dep.assets[sym].token;
    const raw = side === "buy" ? BigInt(Math.floor(amt * 1e6)) : BigInt(Math.floor(amt * 1e18));
    await flow.run([
      async () => {
        await ensure();
        return writeContractAsync({
          address: v.address,
          abi: abi.vault,
          functionName: "trade",
          args: side === "buy" ? [dep.usdg, token, raw, BigInt(band)] : [token, dep.usdg, raw, BigInt(band)],
          chainId,
        });
      },
    ]);
    setAmount("");
  }
  const busy = flow.state === "signing" || flow.state === "confirming";

  return (
    <Panel>
      <div className="grid grid-cols-2 border-b border-line">
        {(["buy", "sell"] as const).map((s) => (
          <button key={s} onClick={() => setSide(s)} className={`py-3 text-sm uppercase tracking-wider transition-colors ${side === s ? (s === "buy" ? "bg-gain/10 text-gain" : "bg-loss/10 text-loss") : "text-dim hover:text-mute"}`}>
            {s}
          </button>
        ))}
      </div>
      <div className="p-5">
        <div className="grid grid-cols-4 gap-1.5">
          {v.assets.map((s) => {
            const w = v.holdings.find((x) => x.sym === s)?.weight ?? 0;
            return (
              <button key={s} onClick={() => setSym(s)} className={`relative flex flex-col items-center gap-1 border py-2.5 transition-colors ${sym === s ? "border-cream bg-ink-3" : "border-line hover:border-line-2"}`}>
                <AssetGlyph sym={s} size={22} />
                <span className="num text-[10px] text-cream">{s}</span>
                <span className="absolute inset-x-0 bottom-0 h-[2px] bg-signal" style={{ width: `${w * 100}%` }} />
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex items-baseline justify-between">
          <Label>{side === "buy" ? "Spend USDG" : `Sell ${sym}`}</Label>
          <button onClick={() => setAmount(String(Math.floor(maxIn * (side === "buy" ? 100 : 1e4)) / (side === "buy" ? 100 : 1e4)))} className="num text-[11px] text-mute hover:text-cream">
            max {fmtNum(maxIn, side === "buy" ? 2 : 4)}
          </button>
        </div>
        <div className="mt-2 flex items-center border border-line-2 bg-ink focus-within:border-signal">
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0" inputMode="decimal" className="num w-full bg-transparent px-3 py-3 text-2xl text-cream outline-none placeholder:text-dim" />
          <span className="pr-3 num text-xs text-mute">{side === "buy" ? "USDG" : sym}</span>
        </div>

        {/* oracle band: where the fill must land */}
        <div className="mt-5">
          <div className="flex items-baseline justify-between">
            <Label>Oracle band</Label>
            <span className="num text-sm text-cream">{band} bps</span>
          </div>
          <input type="range" min={10} max={150} step={5} value={band} onChange={(e) => setBand(Number(e.target.value))} className="tape-range mt-3 w-full" />
          <div className="relative mt-3 h-8 border border-line bg-ink">
            <div className="absolute inset-y-0 right-0 bg-gain/10" style={{ left: `${100 - (band / 150) * 100}%` }} />
            <div className="absolute inset-y-0 w-px bg-signal" style={{ left: `${100 - (SPREAD * 1e4 / 150) * 100}%` }} title="expected fill" />
            <div className="absolute inset-y-0 right-0 w-px bg-cream" title="oracle" />
            <span className="absolute -bottom-4 right-0 num text-[9px] text-dim">ORACLE</span>
            <span className="absolute -bottom-4 num text-[9px] text-signal" style={{ left: `${100 - (SPREAD * 1e4 / 150) * 100}%`, transform: "translateX(-50%)" }}>FILL</span>
          </div>
        </div>

        <div className="mt-7 space-y-2 num text-xs">
          <div className="flex justify-between text-mute"><span>Chainlink</span><span className="text-cream">{fmtUsd(price)}</span></div>
          <div className="flex justify-between text-mute"><span>Expected</span><span className="text-cream">{fmtNum(expected, side === "buy" ? 4 : 2)} {side === "buy" ? sym : "USDG"}</span></div>
          <div className="flex justify-between text-mute"><span>Floor</span><span>{fmtNum(floor, side === "buy" ? 4 : 2)}</span></div>
        </div>

        <button onClick={submit} disabled={!ok || busy} className={`mt-5 flex w-full items-center justify-center gap-2 py-3.5 font-medium text-ink transition-all hover:brightness-110 disabled:opacity-40 ${side === "buy" ? "bg-gain" : "bg-loss"}`}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : flow.state === "done" ? <Check size={15} /> : <ArrowDownUp size={15} />}
          {stale ? "Market closed" : flow.state === "done" ? "Filled" : `${side === "buy" ? "Buy" : "Sell"} ${sym}`}
        </button>
        {flow.error && <div className="mt-3 num text-xs text-loss">{flow.error}</div>}
      </div>
    </Panel>
  );
}

function StampButton({ v }: { v: Vault }) {
  const { chainId } = useNetwork();
  const ensure = useEnsureChain();
  const { writeContractAsync } = useWriteContract();
  const flow = useTxFlow();
  const now = useNow();
  const wait = Math.max(0, v.lastCheckpoint + 60 - now);
  const busy = flow.state === "signing" || flow.state === "confirming";
  return (
    <button
      disabled={busy || wait > 0}
      onClick={() => flow.run([async () => (await ensure(), writeContractAsync({ address: v.address, abi: abi.vault, functionName: "checkpoint", chainId }))])}
      className="flex w-full items-center justify-center gap-2 border border-signal py-3 text-sm text-signal transition-colors hover:bg-signal hover:text-ink disabled:opacity-40"
    >
      {busy ? <Loader2 size={15} className="animate-spin" /> : <Stamp size={15} />}
      {flow.state === "done" ? "Stamped" : wait > 0 ? `Stamp in ${Math.ceil(wait)}s` : "Stamp checkpoint"}
    </button>
  );
}

export default function Manage() {
  const { address } = useAccount();
  const { data, isLoading } = useVaults();
  const mine = useMemo(() => (data?.vaults ?? []).filter((v) => v.manager.toLowerCase() === address?.toLowerCase()), [data, address]);
  const [sel, setSel] = useState<string | null>(null);
  const v = mine.find((x) => x.address === sel) ?? mine[0];

  if (!address)
    return (
      <div className="mx-auto grid max-w-md place-items-center gap-4 py-24">
        <SlidersHorizontal size={36} className="text-dim" strokeWidth={1.2} />
        <ConnectButton />
      </div>
    );
  if (isLoading) return <Skeleton className="mx-auto h-96 max-w-[1300px]" />;
  if (!v)
    return (
      <Link href="/app/create" className="mx-auto mt-16 flex max-w-xl flex-col items-center gap-3 border border-dashed border-line py-20 text-mute transition-colors hover:border-signal hover:text-signal">
        <Plus size={28} strokeWidth={1.3} />
        <span className="text-sm">Launch your first vault</span>
      </Link>
    );

  return (
    <div className="mx-auto max-w-[1300px]">
      <div className="scrollbar-none mb-5 flex gap-2 overflow-x-auto">
        {mine.map((x) => (
          <button key={x.address} onClick={() => setSel(x.address)} className={`flex shrink-0 items-center gap-2 border px-3 py-2 transition-colors ${x.address === v.address ? "border-cream bg-ink-3" : "border-line hover:border-line-2"}`}>
            <Identicon address={x.address} size={18} />
            <span className="text-sm text-cream">{x.name}</span>
            <span className={`num text-xs ${tone(x.metrics.totalReturn)}`}>{fmtPct(x.metrics.totalReturn)}</span>
          </button>
        ))}
        <Link href="/app/create" className="grid shrink-0 place-items-center border border-dashed border-line px-3 text-dim hover:text-cream"><Plus size={16} /></Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-4">
          <Panel className="p-5">
            <EquityChart series={v.series} height={260} />
          </Panel>
          <Panel>
            <div className="grid grid-cols-[1fr_auto] items-center px-5 pt-4">
              <Label>Book</Label>
              <Label>{fmtUsd(v.value)}</Label>
            </div>
            <div className="divide-y divide-line">
              {[...v.holdings].sort((a, b) => b.value - a.value).map((h) => (
                <div key={h.sym} className="grid grid-cols-[28px_70px_1fr_100px_90px] items-center gap-3 px-5 py-3">
                  <AssetGlyph sym={h.sym} size={24} />
                  <span className="num text-sm text-cream">{h.sym}</span>
                  <div className="h-2 bg-line"><div className="h-full bg-cream/70 transition-[width] duration-700" style={{ width: `${h.weight * 100}%` }} /></div>
                  <span className="num text-right text-xs text-mute">{fmtNum(h.amount, h.sym === "USDG" ? 2 : 4)}</span>
                  <span className="num text-right text-sm text-cream">{(h.weight * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </Panel>
          <div className="grid grid-cols-3 gap-px border border-line bg-line">
            {[
              ["High-water", v.hwm.toFixed(4)],
              ["NAV / share", v.pps.toFixed(4)],
              ["Fee", `${v.feeBps / 100}%`],
            ].map(([l, x]) => (
              <div key={l} className="bg-ink-2 px-4 py-3">
                <Label>{l}</Label>
                <div className="num mt-1 text-lg text-cream">{x}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <TradeTicket key={v.address} v={v} />
          <StampButton v={v} />
        </div>
      </div>
    </div>
  );
}
