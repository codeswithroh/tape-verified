"use client";
import Link from "next/link";
import { useAccount } from "wagmi";
import { ArrowUpRight, PieChart } from "lucide-react";
import { usePositions, type Holding } from "@/hooks/useTape";
import { Sparkline } from "@/components/charts/Sparkline";
import { AllocationBar } from "@/components/charts/AllocationBar";
import { ConnectButton, useUsdgBalance } from "@/components/app/Wallet";
import { Identicon } from "@/components/ui/Identicon";
import { AssetGlyph } from "@/components/ui/AssetChip";
import { Label, Panel, Skeleton } from "@/components/ui/bits";
import { ASSET_META } from "@/lib/contracts";
import { fmtNum, fmtPct, fmtUsd, tone } from "@/lib/format";
import { offsets } from "@/lib/series";

function Donut({ parts, size = 200 }: { parts: { key: string; value: number; color: string }[]; size?: number }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const r = 42, c = 2 * Math.PI * r;
  const lens = parts.map((p) => (p.value / total) * c);
  const offs = offsets(lens);
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="-rotate-90">
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-line)" strokeWidth="10" />
      {parts.map((p, i) => (
        <circle key={p.key} cx="50" cy="50" r={r} fill="none" stroke={p.color} strokeWidth="10" strokeDasharray={`${Math.max(0, lens[i] - 0.6)} ${c}`} strokeDashoffset={-offs[i]} className="transition-all duration-700" />
      ))}
    </svg>
  );
}

export default function Portfolio() {
  const { address } = useAccount();
  const { data: pos, isLoading } = usePositions(address);
  const cash = useUsdgBalance() ?? 0;

  if (!address)
    return (
      <div className="mx-auto grid max-w-md place-items-center gap-4 py-24 text-center">
        <PieChart size={36} className="text-dim" strokeWidth={1.2} />
        <ConnectButton />
      </div>
    );

  const invested = (pos ?? []).reduce((a, p) => a + p.value, 0);
  const cost = (pos ?? []).reduce((a, p) => a + p.cost, 0);
  const pnl = invested - cost;

  // look-through: what you actually own across all vaults
  const look: Record<string, Holding> = {};
  for (const p of pos ?? [])
    for (const h of p.vault.holdings) {
      const cur = look[h.sym] ?? { ...h, amount: 0, value: 0, weight: 0 };
      cur.amount += h.amount * p.share;
      cur.value += h.value * p.share;
      look[h.sym] = cur;
    }
  const lookArr = Object.values(look).map((h) => ({ ...h, weight: invested ? h.value / invested : 0 })).sort((a, b) => b.value - a.value);

  return (
    <div className="mx-auto max-w-[1300px]">
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Panel className="relative overflow-hidden p-6">
          <div className="ledger-dark absolute inset-0 opacity-50" />
          <div className="relative flex flex-wrap items-end gap-10">
            <div>
              <Label>Portfolio</Label>
              <div className="num mt-2 text-5xl leading-none text-cream">{fmtUsd(invested + cash)}</div>
            </div>
            <div>
              <Label>Copied</Label>
              <div className="num mt-2 text-2xl text-cream">{fmtUsd(invested)}</div>
            </div>
            <div>
              <Label>P&L</Label>
              <div className={`num mt-2 text-2xl ${tone(pnl)}`}>{pnl >= 0 ? "+" : ""}{fmtUsd(pnl)} <span className="text-sm">{cost ? fmtPct(pnl / cost) : ""}</span></div>
            </div>
            <div>
              <Label>Cash</Label>
              <div className="num mt-2 text-2xl text-mute">{fmtUsd(cash)}</div>
            </div>
          </div>
          <div className="relative mt-8">
            <Label className="mb-2">Look-through exposure</Label>
            <AllocationBar holdings={lookArr} height={18} />
          </div>
        </Panel>
        <Panel className="flex items-center gap-6 p-6">
          <div className="relative">
            <Donut parts={lookArr.map((h) => ({ key: h.sym, value: h.value, color: ASSET_META[h.sym]?.color ?? "#777" }))} size={150} />
            <div className="absolute inset-0 grid place-items-center num text-xs text-mute">{lookArr.length} assets</div>
          </div>
          <div className="flex-1 space-y-1.5">
            {lookArr.slice(0, 7).map((h) => (
              <div key={h.sym} className="flex items-center gap-2 num text-xs">
                <span className="h-2 w-2" style={{ background: ASSET_META[h.sym]?.color }} />
                <span className="text-cream">{h.sym}</span>
                <span className="ml-auto text-mute">{(h.weight * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-6 flex items-center gap-2">
        <Label>Positions</Label>
        <div className="h-px flex-1 bg-line" />
      </div>
      <div className="mt-3 space-y-2">
        {isLoading && <Skeleton className="h-20" />}
        {pos?.length === 0 && (
          <Link href="/app" className="flex items-center justify-center gap-2 border border-dashed border-line py-12 num text-sm text-mute hover:border-signal hover:text-signal">
            Find a portfolio to copy <ArrowUpRight size={15} />
          </Link>
        )}
        {pos?.map((p) => {
          const pl = p.value - p.cost;
          return (
            <Link key={p.vault.address} href={`/app/v/${p.vault.address}`} className="grid grid-cols-2 items-center gap-4 border border-line bg-ink-2 px-4 py-3 transition-colors hover:border-line-2 md:grid-cols-[minmax(200px,1.4fr)_1fr_110px_110px_120px_160px]">
              <div className="flex items-center gap-3">
                <Identicon address={p.vault.manager} size={30} />
                <div>
                  <div className="text-sm text-cream">{p.vault.name}</div>
                  <div className="num text-[11px] text-dim">{fmtNum(p.shares, 2)} {p.vault.symbol}</div>
                </div>
              </div>
              <Sparkline data={p.vault.series.map((x) => x.pps)} height={36} />
              <div className="num text-sm text-cream">{fmtUsd(p.value)}</div>
              <div className={`num text-sm ${tone(pl)}`}>{pl >= 0 ? "+" : ""}{fmtUsd(pl)}</div>
              <div className="num text-xs text-mute">{(p.share * 100).toFixed(2)}% of vault</div>
              <div className="flex -space-x-1">
                {p.vault.holdings.filter((h) => h.weight > 0.01).slice(0, 6).map((h) => (
                  <span key={h.sym} className="ring-2 ring-ink-2"><AssetGlyph sym={h.sym} size={20} /></span>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
