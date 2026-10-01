"use client";
import { useId, useMemo, useRef, useState } from "react";
import type { Point } from "@/hooks/useTape";
import { fmtPct } from "@/lib/format";
import { runningMax } from "@/lib/series";

/** Net-of-fee share price over the vault's on-chain tape, with running high-water mark,
 *  drawdown shading and one tick per checkpoint along the baseline. */
export function EquityChart({ series, height = 300 }: { series: Point[]; height?: number }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 1000;
  const H = height;
  const padT = 52, padB = 34;

  const g = useMemo(() => {
    const v = series.map((p) => p.pps);
    const base = v[0] ?? 1;
    const r = v.map((x) => x / base - 1);
    const hwm = runningMax(r);
    const min = Math.min(...r, 0);
    const max = Math.max(...r, 0);
    const span = max - min || 0.01;
    const x = (i: number) => (series.length < 2 ? 0 : (i / (series.length - 1)) * W);
    const y = (val: number) => padT + (1 - (val - min) / span) * (H - padT - padB);
    const line = r.map((val, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(val).toFixed(1)}`).join("");
    const hwmLine = hwm.map((val, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(val).toFixed(1)}`).join("");
    const gap = r.map((_, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(hwm[i]).toFixed(1)}`).join("") +
      r.slice().reverse().map((val, j) => `L${x(r.length - 1 - j).toFixed(1)},${y(val).toFixed(1)}`).join("") + "Z";
    return { r, hwm, x, y, line, hwmLine, gap, zero: y(0), min, max };
  }, [series, H]);

  if (series.length < 2) return <div style={{ height }} className="grid place-items-center text-mute num text-xs">awaiting checkpoints</div>;
  const up = g.r.at(-1)! >= 0;
  const color = up ? "var(--color-gain)" : "var(--color-loss)";
  const h = hover ?? series.length - 1;
  const p = series[h];

  const onMove = (e: React.MouseEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    const t = (e.clientX - rect.left) / rect.width;
    setHover(Math.max(0, Math.min(series.length - 1, Math.round(t * (series.length - 1)))));
  };

  const intraday = series.at(-1)!.ts - series[0].ts < 2 * 86400 && !series[0].date;
  const label = (pt: Point) => pt.date ?? new Date(pt.ts * 1000).toISOString().slice(0, intraday ? 16 : 10).replace("T", " ");
  const axis = (pt: Point) => (pt.date ? pt.date.slice(5) : intraday ? new Date(pt.ts * 1000).toISOString().slice(11, 16) : label(pt).slice(5));
  const ticks = Array.from(new Set([0, Math.floor(series.length / 3), Math.floor((2 * series.length) / 3), series.length - 1]));

  return (
    <div ref={ref} className="relative select-none" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <div className="pointer-events-none absolute left-0 top-0 flex items-baseline gap-3 num">
        <span className={`text-3xl ${g.r[h] >= 0 ? "text-gain" : "text-loss"}`}>{fmtPct(g.r[h], 2)}</span>
        <span className="text-xs text-mute">{label(p)}</span>
        {g.hwm[h] > g.r[h] + 1e-9 && <span className="text-xs text-loss">{fmtPct(g.r[h] - g.hwm[h], 2)} from peak</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" className="overflow-visible">
        <defs>
          <linearGradient id={`${id}a`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.22" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={W} y1={padT + f * (H - padT - padB)} y2={padT + f * (H - padT - padB)} stroke="var(--color-line)" strokeDasharray="2 6" vectorEffect="non-scaling-stroke" />
        ))}
        <line x1="0" x2={W} y1={g.zero} y2={g.zero} stroke="var(--color-line-2)" vectorEffect="non-scaling-stroke" />
        <path d={`${g.line}L${W},${H - padB}L0,${H - padB}Z`} fill={`url(#${id}a)`} />
        <path d={g.gap} fill="var(--color-loss)" opacity="0.12" />
        <path d={g.hwmLine} fill="none" stroke="var(--color-cream)" strokeOpacity="0.35" strokeDasharray="3 4" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <path d={g.line} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {/* the tape: one tick per on-chain checkpoint */}
        {series.map((_, i) => (
          <line key={i} x1={g.x(i)} x2={g.x(i)} y1={H - padB + 8} y2={H - padB + (i === h ? 18 : 13)} stroke={i === h ? "var(--color-signal)" : "var(--color-dim)"} strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        <line x1={g.x(h)} x2={g.x(h)} y1={padT} y2={H - padB} stroke="var(--color-cream)" strokeOpacity="0.25" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="pointer-events-none absolute" style={{ left: `${(g.x(h) / W) * 100}%`, top: g.y(g.r[h]), transform: "translate(-50%,-50%)" }}>
        <div className="h-2.5 w-2.5 rotate-45 border border-ink" style={{ background: color }} />
      </div>
      <div className="mt-1 flex justify-between num text-[10px] uppercase tracking-wider text-dim">
        {ticks.map((t) => (
          <span key={t}>{axis(series[t])}</span>
        ))}
      </div>
    </div>
  );
}
