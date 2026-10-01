"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { useCopiers, useVaults, type Vault } from "@/hooks/useTape";
import { VaultCard } from "@/components/app/VaultCard";
import { EquityChart } from "@/components/charts/EquityChart";
import { Identicon } from "@/components/ui/Identicon";
import { Seal } from "@/components/ui/Seal";
import { Chip, Label, Panel, Skeleton, Stat } from "@/components/ui/bits";
import { fmtPct, fmtUsd, tone } from "@/lib/format";
import { ASSET_META } from "@/lib/contracts";

const SORTS = {
  sharpe: { label: "Sharpe", key: (v: Vault) => v.sharpeAnn },
  return: { label: "Return", key: (v: Vault) => v.metrics.totalReturn },
  drawdown: { label: "Shallowest DD", key: (v: Vault) => -v.metrics.maxDrawdown },
  tvl: { label: "TVL", key: (v: Vault) => v.value },
} as const;
type SortKey = keyof typeof SORTS;

function RiskMap({ vaults }: { vaults: Vault[] }) {
  const W = 420, H = 260, P = 34;
  const maxDD = Math.max(0.05, ...vaults.map((v) => v.metrics.maxDrawdown)) * 1.15;
  const rets = vaults.map((v) => v.metrics.totalReturn);
  const lo = Math.min(-0.02, ...rets) * 1.2, hi = Math.max(0.02, ...rets) * 1.2;
  const maxTvl = Math.max(1, ...vaults.map((v) => v.value));
  const x = (dd: number) => P + (dd / maxDD) * (W - P * 1.5);
  const y = (r: number) => H - P - ((r - lo) / (hi - lo)) * (H - P * 1.6);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <line x1={P} x2={W - 6} y1={y(0)} y2={y(0)} stroke="var(--color-line-2)" />
      <line x1={P} x2={P} y1={10} y2={H - P} stroke="var(--color-line-2)" />
      {/* the efficient corner */}
      <path d={`M${P},${10} L${P + 90},${10} L${P},${10 + 70} Z`} fill="var(--color-gain)" opacity="0.06" />
      <text x={P + 6} y={24} className="num" fontSize="9" fill="var(--color-gain)" opacity="0.7">LOW RISK · HIGH RETURN</text>
      <text x={W - 8} y={H - 12} textAnchor="end" className="num" fontSize="9" fill="var(--color-dim)">MAX DRAWDOWN →</text>
      <text x={10} y={14} className="num" fontSize="9" fill="var(--color-dim)">↑ RETURN</text>
      {vaults.map((v) => {
        const r = 6 + Math.sqrt(v.value / maxTvl) * 16;
        const c = v.metrics.totalReturn >= 0 ? "var(--color-gain)" : "var(--color-loss)";
        return (
          <Link key={v.address} href={`/app/v/${v.address}`}>
            <g className="cursor-pointer transition-opacity hover:opacity-80">
              <circle cx={x(v.metrics.maxDrawdown)} cy={y(v.metrics.totalReturn)} r={r} fill={c} fillOpacity="0.15" stroke={c} />
              <text x={x(v.metrics.maxDrawdown) + r + 4} y={y(v.metrics.totalReturn) + 3} fontSize="10" fill="var(--color-cream)" className="num">
                {v.symbol}
              </text>
            </g>
          </Link>
        );
      })}
    </svg>
  );
}

function Leader({ v }: { v: Vault }) {
  return (
    <Panel className="relative overflow-hidden lg:col-span-2">
      <div className="ledger-dark absolute inset-0 opacity-60" />
      <div className="relative grid gap-6 p-5 md:grid-cols-[1fr_auto]">
        <div className="flex items-center gap-3">
          <Identicon address={v.manager} size={40} />
          <div>
            <div className="flex items-center gap-2">
              <Seal size={26} spin={false} label="VERIFIED · " className="text-cream/50" />
              <Chip tone="signal">#1 {SORTS.sharpe.label}</Chip>
              {v.replay && <Chip>Replay</Chip>}
            </div>
            <Link href={`/app/v/${v.address}`} className="mt-1 flex items-center gap-1 font-serif text-3xl leading-none text-cream hover:text-signal">
              {v.name} <ArrowUpRight size={20} />
            </Link>
          </div>
        </div>
        <div className="flex items-end gap-6">
          <Stat label="Return" value={<span className={tone(v.metrics.totalReturn)}>{fmtPct(v.metrics.totalReturn)}</span>} />
          <Stat label="Sharpe" value={v.sharpeAnn.toFixed(2)} />
          <Stat label="Max DD" value={<span className="text-loss">{fmtPct(-v.metrics.maxDrawdown)}</span>} />
        </div>
      </div>
      <div className="relative px-5 pb-4">
        <EquityChart series={v.series} height={220} />
      </div>
    </Panel>
  );
}

export default function Discover() {
  const { data, isLoading, error } = useVaults();
  const { data: copiers } = useCopiers();
  const [sort, setSort] = useState<SortKey>("sharpe");
  const [asset, setAsset] = useState<string | null>(null);

  const vaults = useMemo(() => {
    const vs = (data?.vaults ?? []).filter((v) => !asset || v.assets.includes(asset));
    return [...vs].sort((a, b) => SORTS[sort].key(b) - SORTS[sort].key(a));
  }, [data, sort, asset]);
  const all = data?.vaults ?? [];
  const leader = [...all].sort((a, b) => b.sharpeAnn - a.sharpeAnn)[0];
  const tvl = all.reduce((a, v) => a + v.value, 0);
  const stamps = all.reduce((a, v) => a + v.metrics.n, 0);
  const totalCopiers = Object.values(copiers ?? {}).reduce((a, n) => a + n, 0);
  const assets = Array.from(new Set(all.flatMap((v) => v.assets)));

  if (error) return <div className="num text-sm text-loss">RPC error · {(error as Error).message.slice(0, 120)}</div>;

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-6 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
        {[
          ["Verified vaults", all.length || "—"],
          ["On-chain stamps", stamps || "—"],
          ["Value copied", tvl ? fmtUsd(tvl, true) : "—"],
          ["Copiers", totalCopiers || "—"],
        ].map(([l, v], i) => (
          <div key={l as string} className="animate-rise bg-ink px-5 py-4" style={{ animationDelay: `${i * 60}ms` }}>
            <Label>{l}</Label>
            <div className="num mt-2 text-3xl leading-none text-cream">{v}</div>
          </div>
        ))}
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        {isLoading || !leader ? <Skeleton className="h-[360px] lg:col-span-2" /> : <Leader v={leader} />}
        <Panel className="flex flex-col p-5">
          <div className="flex items-center justify-between">
            <Label>Risk / return</Label>
            <Label>size = TVL</Label>
          </div>
          <div className="mt-2 flex-1">{isLoading ? <Skeleton className="h-full min-h-[240px]" /> : <RiskMap vaults={all} />}</div>
        </Panel>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex border border-line">
          {(Object.keys(SORTS) as SortKey[]).map((k) => (
            <button key={k} onClick={() => setSort(k)} className={`px-3 py-1.5 num text-[11px] uppercase tracking-wider transition-colors ${sort === k ? "bg-cream text-ink" : "text-mute hover:text-cream"}`}>
              {SORTS[k].label}
            </button>
          ))}
        </div>
        <div className="scrollbar-none flex gap-1 overflow-x-auto">
          <button onClick={() => setAsset(null)} className={`border px-2 py-1 num text-[11px] ${!asset ? "border-cream text-cream" : "border-line text-dim hover:text-mute"}`}>ALL</button>
          {assets.map((s) => (
            <button key={s} onClick={() => setAsset(asset === s ? null : s)} className={`flex items-center gap-1.5 border px-2 py-1 num text-[11px] ${asset === s ? "border-cream text-cream" : "border-line text-dim hover:text-mute"}`}>
              <span className="h-1.5 w-1.5" style={{ background: ASSET_META[s]?.color }} />
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {isLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[268px]" />)}
        {vaults.map((v, i) => (
          <VaultCard key={v.address} v={v} rank={i + 1} copiers={copiers?.[v.address.toLowerCase()]} delay={i * 70} />
        ))}
      </div>
    </div>
  );
}
