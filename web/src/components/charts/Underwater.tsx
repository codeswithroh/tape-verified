"use client";
import type { Point } from "@/hooks/useTape";
import { runningMax } from "@/lib/series";

/** Drawdown from running peak, drawn below the waterline. */
export function Underwater({ series, height = 90 }: { series: Point[]; height?: number }) {
  if (series.length < 2) return null;
  const peaks = runningMax(series.map((p) => p.pps));
  const dd = series.map((p, i) => p.pps / peaks[i] - 1);
  const min = Math.min(...dd, -0.01);
  const W = 1000;
  const x = (i: number) => (i / (series.length - 1)) * W;
  const y = (v: number) => (v / min) * (height - 4);
  const d = dd.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const worst = dd.indexOf(Math.min(...dd));
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} preserveAspectRatio="none">
        <defs>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-loss)" strokeOpacity="0.35" strokeWidth="2" />
          </pattern>
        </defs>
        <line x1="0" x2={W} y1="0.5" y2="0.5" stroke="var(--color-line-2)" vectorEffect="non-scaling-stroke" />
        <path d={`${d}L${W},0L0,0Z`} fill="url(#hatch)" />
        <path d={d} fill="none" stroke="var(--color-loss)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="pointer-events-none absolute num text-[10px] text-loss" style={{ left: `${(x(worst) / W) * 100}%`, top: y(dd[worst]) + 4, transform: "translateX(-50%)" }}>
        {(dd[worst] * 100).toFixed(1)}%
      </div>
    </div>
  );
}
