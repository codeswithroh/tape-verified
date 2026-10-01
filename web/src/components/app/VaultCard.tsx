"use client";
import Link from "next/link";
import type { Vault } from "@/hooks/useTape";
import { Sparkline } from "@/components/charts/Sparkline";
import { AllocationBar } from "@/components/charts/AllocationBar";
import { AssetStack } from "@/components/ui/AssetChip";
import { Identicon } from "@/components/ui/Identicon";
import { Gauge, Label } from "@/components/ui/bits";
import { fmtPct, fmtUsd, tone } from "@/lib/format";
import { BadgeCheck, Users } from "lucide-react";

export function VaultCard({ v, rank, copiers, delay = 0 }: { v: Vault; rank: number; copiers?: number; delay?: number }) {
  const r = v.metrics.totalReturn;
  return (
    <Link
      href={`/app/v/${v.address}`}
      style={{ animationDelay: `${delay}ms` }}
      className="group relative flex animate-rise flex-col border border-line bg-ink-2 transition-all duration-300 hover:-translate-y-0.5 hover:border-line-2 hover:bg-ink-3"
    >
      <div className="flex items-center gap-3 px-4 pt-4">
        <span className="num w-5 text-xs text-dim">{String(rank).padStart(2, "0")}</span>
        <Identicon address={v.manager} size={30} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 truncate font-medium text-cream">
            {v.name}
            <BadgeCheck size={14} className="shrink-0 text-signal" />
          </div>
          <div className="num text-[11px] text-dim">{v.symbol} · {v.feeBps / 100}% perf</div>
        </div>
        <div className="text-right">
          <div className={`num text-2xl leading-none ${tone(r)}`}>{fmtPct(r)}</div>
          <Label className="mt-1">{v.metrics.n} stamps</Label>
        </div>
      </div>

      <div className="mt-3 px-1">
        <Sparkline data={v.series.map((p) => p.pps)} height={64} />
      </div>

      <div className="grid grid-cols-3 gap-4 border-t border-line px-4 py-3">
        <div>
          <Label>Max DD</Label>
          <div className="num mt-1 text-sm text-loss">{fmtPct(-v.metrics.maxDrawdown, 1)}</div>
          <Gauge value={v.metrics.maxDrawdown} max={0.3} color="var(--color-loss)" className="mt-1.5" />
        </div>
        <div>
          <Label>Sharpe</Label>
          <div className="num mt-1 text-sm text-cream">{v.sharpeAnn.toFixed(2)}</div>
          <Gauge value={v.sharpeAnn} max={4} color={v.sharpeAnn >= 0 ? "var(--color-gain)" : "var(--color-loss)"} className="mt-1.5" />
        </div>
        <div>
          <Label>TVL</Label>
          <div className="num mt-1 text-sm text-cream">{fmtUsd(v.value, true)}</div>
          <Gauge value={v.value} max={30_000} color="var(--color-signal)" className="mt-1.5" />
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-line px-4 py-3">
        <AssetStack syms={v.assets} size={18} />
        <div className="flex-1">
          <AllocationBar holdings={v.holdings} height={4} />
        </div>
        <span className="flex items-center gap-1 num text-[11px] text-mute">
          <Users size={12} /> {copiers ?? 0}
        </span>
      </div>
    </Link>
  );
}
