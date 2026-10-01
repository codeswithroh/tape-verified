"use client";
import { useId } from "react";

export function Sparkline({ data, width = 160, height = 44, stroke, className }: { data: number[]; width?: number; height?: number; stroke?: string; className?: string }) {
  const id = useId();
  if (data.length < 2) return <div style={{ width, height }} className={className} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const x = (i: number) => (i / (data.length - 1)) * width;
  const y = (v: number) => height - 3 - ((v - min) / span) * (height - 6);
  const up = data.at(-1)! >= data[0];
  const color = stroke ?? (up ? "var(--color-gain)" : "var(--color-loss)");
  const d = data.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" className={className}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d}L${width},${height}L0,${height}Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <circle cx={x(data.length - 1)} cy={y(data.at(-1)!)} r="2.5" fill={color} />
    </svg>
  );
}
