"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BadgeCheck, Cpu, ExternalLink } from "lucide-react";
import { useActivity, useVault, type Activity, type Vault } from "@/hooks/useTape";
import { useNetwork } from "@/components/Providers";
import { EquityChart } from "@/components/charts/EquityChart";
import { Underwater } from "@/components/charts/Underwater";
import { AllocationBar } from "@/components/charts/AllocationBar";
import { CopyPanel } from "@/components/app/CopyPanel";
import { Identicon } from "@/components/ui/Identicon";
import { AssetGlyph } from "@/components/ui/AssetChip";
import { Chip, Label, Panel, Skeleton } from "@/components/ui/bits";
import { CHAINS } from "@/lib/chains";
import { fmtNum, fmtPct, fmtUsd, short, tone } from "@/lib/format";

function MetricTile({ label, value, cls = "text-cream", hint }: { label: string; value: string; cls?: string; hint?: string }) {
  return (
    <div className="group relative bg-ink-2 px-4 py-4">
      <Label>{label}</Label>
      <div className={`num mt-2 text-2xl leading-none ${cls}`}>{value}</div>
      {hint && <div className="num mt-1.5 text-[10px] text-dim">{hint}</div>}
      <Cpu size={11} className="absolute right-3 top-3 text-dim opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  );
}

function Header({ v }: { v: Vault }) {
  const { chainId } = useNetwork();
  const explorer = CHAINS.find((c) => c.id === chainId)?.blockExplorers?.default.url;
  const first = v.series[0];
  const last = v.series.at(-1);
  return (
    <div className="mb-6 flex flex-wrap items-end gap-x-6 gap-y-4">
      <div className="flex items-center gap-4">
        <Identicon address={v.manager} size={52} />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="signal"><BadgeCheck size={11} /> Verified tape</Chip>
            <Chip>{v.symbol}</Chip>
            {v.replay && first?.date && <Chip tone="volt">Replay {first.date.slice(5)} → {last?.date?.slice(5)}</Chip>}
          </div>
          <h1 className="mt-1.5 font-serif text-4xl leading-none text-cream md:text-5xl">{v.name}</h1>
          <a href={`${explorer}/address/${v.manager}`} target="_blank" className="mt-1.5 inline-flex items-center gap-1 num text-xs text-mute hover:text-cream">
            {short(v.manager)} <ExternalLink size={11} />
          </a>
        </div>
      </div>
      <div className="ml-auto flex gap-8">
        <div>
          <Label>NAV / share</Label>
          <div className="num mt-1 text-2xl text-cream">{v.pps.toFixed(4)}</div>
        </div>
        <div>
          <Label>TVL</Label>
          <div className="num mt-1 text-2xl text-cream">{fmtUsd(v.value)}</div>
        </div>
      </div>
    </div>
  );
}

function ActivityRow({ a, explorer }: { a: Activity; explorer?: string }) {
  const href = `${explorer}/tx/${a.tx}`;
  if (a.kind === "trade") {
    const buy = a.tokenIn === "USDG";
    const sym = buy ? a.tokenOut : a.tokenIn;
    return (
      <a href={href} target="_blank" className="grid grid-cols-[52px_1fr_auto] items-center gap-3 px-4 py-2.5 hover:bg-ink-3">
        <span className={`num text-[10px] font-semibold uppercase tracking-wider ${buy ? "text-gain" : "text-loss"}`}>{buy ? "Buy" : "Sell"}</span>
        <span className="flex items-center gap-2 num text-xs text-cream">
          <AssetGlyph sym={sym} size={18} />
          {fmtNum(buy ? a.amountOut : a.amountIn, 3)} {sym}
          <ArrowRight size={11} className="text-dim" />
          <span className="text-mute">{fmtUsd(buy ? a.amountIn : a.amountOut)}</span>
        </span>
        <span className={`num text-[10px] ${a.slippageBps > 40 ? "text-loss" : "text-mute"}`}>{a.slippageBps.toFixed(0)} bps</span>
      </a>
    );
  }
  return (
    <a href={href} target="_blank" className="grid grid-cols-[52px_1fr_auto] items-center gap-3 px-4 py-2.5 hover:bg-ink-3">
      <span className={`num text-[10px] font-semibold uppercase tracking-wider ${a.kind === "deposit" ? "text-signal" : "text-mute"}`}>{a.kind === "deposit" ? "In" : "Out"}</span>
      <span className="flex items-center gap-2 num text-xs text-cream">
        <Identicon address={a.who} size={16} />
        {a.kind === "deposit" ? fmtUsd(a.usdg) : `${fmtNum(a.shares, 2)} sh`}
      </span>
      <span className="num text-[10px] text-dim">{short(a.who)}</span>
    </a>
  );
}

function Receipt({ v }: { v: Vault }) {
  const rows = [...v.series].reverse().slice(0, 40);
  return (
    <div className="relative bg-paper text-ink">
      <div className="perf-x absolute -top-2 left-0 right-0 text-paper" style={{ transform: "scaleY(-1)" }} />
      <div className="px-4 pb-2 pt-4 text-center">
        <div className="font-serif text-2xl leading-none">The Tape</div>
        <div className="num mt-1 text-[9px] uppercase tracking-[0.2em] text-ink/60">{v.symbol} · {v.metrics.n} stamps · append-only</div>
      </div>
      <div className="ledger max-h-[420px] overflow-y-auto px-4 pb-4 scrollbar-none">
        {rows.map((p, k) => {
          const prev = v.series[p.i - 1];
          const ch = prev ? p.pps / prev.pps - 1 : 0;
          return (
            <div key={p.i} className="grid h-8 grid-cols-[34px_1fr_auto_60px] items-center gap-2 num text-[11px]" style={{ animationDelay: `${k * 20}ms` }}>
              <span className="text-ink/40">#{String(p.i).padStart(3, "0")}</span>
              <span className="text-ink/70">{p.date ?? new Date(p.ts * 1000).toISOString().slice(5, 16).replace("T", " ")}</span>
              <span>{p.pps.toFixed(4)}</span>
              <span className={`text-right ${ch > 0 ? "text-[#0c7a43]" : ch < 0 ? "text-[#c22b2b]" : "text-ink/40"}`}>{prev ? fmtPct(ch, 2) : "genesis"}</span>
            </div>
          );
        })}
      </div>
      <div className="perf-x absolute -bottom-2 left-0 right-0 text-paper" />
    </div>
  );
}

export default function VaultPage() {
  const { address } = useParams<{ address: string }>();
  const { vault: v, isLoading } = useVault(address);
  const { data: acts } = useActivity(v?.address);
  const { chainId } = useNetwork();
  const explorer = CHAINS.find((c) => c.id === chainId)?.blockExplorers?.default.url;

  if (isLoading) return <div className="mx-auto max-w-[1400px] space-y-4"><Skeleton className="h-20" /><Skeleton className="h-[420px]" /></div>;
  if (!v) return <div className="num text-sm text-mute">Vault not found on this network. <Link className="text-signal" href="/app">Back</Link></div>;

  const trades = acts?.filter((a) => a.kind === "trade") ?? [];
  const avgSlip = trades.length ? trades.reduce((s, a) => s + (a.kind === "trade" ? a.slippageBps : 0), 0) / trades.length : 0;

  return (
    <div className="mx-auto max-w-[1400px]">
      <Link href="/app" className="mb-4 inline-flex items-center gap-1 num text-xs text-dim hover:text-cream"><ArrowLeft size={13} /> Discover</Link>
      <Header v={v} />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-4">
          <Panel className="p-5">
            <EquityChart series={v.series} height={320} />
            <div className="mt-4 flex items-center gap-2">
              <Label>Underwater</Label>
              <div className="h-px flex-1 bg-line" />
            </div>
            <Underwater series={v.series} height={70} />
          </Panel>

          <div className="grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-3 xl:grid-cols-6">
            <MetricTile label="Total return" value={fmtPct(v.metrics.totalReturn)} cls={tone(v.metrics.totalReturn)} hint="net of fees" />
            <MetricTile label="Max drawdown" value={fmtPct(-v.metrics.maxDrawdown)} cls="text-loss" />
            <MetricTile label="Sharpe" value={v.sharpeAnn.toFixed(2)} hint="annualised" />
            <MetricTile label="Volatility" value={fmtPct(v.volAnn, 1, false)} hint="annualised" />
            <MetricTile label="Avg fill" value={`${avgSlip.toFixed(0)} bps`} hint="vs Chainlink" />
            <MetricTile label="High-water" value={v.hwm.toFixed(4)} hint="fee floor" />
          </div>
          <div className="flex items-center gap-2 num text-[10px] uppercase tracking-wider text-dim">
            <Cpu size={12} className="text-signal" /> metrics computed on-chain by the Stylus engine
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Panel className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <Label>Holdings</Label>
                <Label>{v.assets.length} allowed</Label>
              </div>
              <AllocationBar holdings={v.holdings} height={14} />
              <div className="mt-4 space-y-2">
                {[...v.holdings].sort((a, b) => b.value - a.value).map((h) => (
                  <div key={h.sym} className="grid grid-cols-[22px_56px_1fr_auto] items-center gap-3">
                    <AssetGlyph sym={h.sym} size={22} />
                    <span className="num text-xs text-cream">{h.sym}</span>
                    <div className="h-1 bg-line"><div className="h-full bg-cream/60" style={{ width: `${h.weight * 100}%` }} /></div>
                    <span className="num w-20 text-right text-xs text-mute">{fmtUsd(h.value, true)}</span>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel className="flex flex-col">
              <div className="flex items-center justify-between px-4 pb-2 pt-4">
                <Label>Activity</Label>
                <Label>{trades.length} trades</Label>
              </div>
              <div className="max-h-[360px] flex-1 divide-y divide-line overflow-y-auto scrollbar-none">
                {!acts && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="m-3 h-6" />)}
                {acts?.map((a) => <ActivityRow key={a.tx + a.kind} a={a} explorer={explorer} />)}
              </div>
            </Panel>
          </div>
        </div>

        <div className="space-y-4">
          <CopyPanel v={v} />
          <Receipt v={v} />
        </div>
      </div>
    </div>
  );
}
