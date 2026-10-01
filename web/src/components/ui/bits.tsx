import type { ReactNode } from "react";

export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`num text-[10px] uppercase tracking-[0.14em] text-dim ${className}`}>{children}</div>;
}

export function Stat({ label, value, sub, className = "", big = false }: { label: ReactNode; value: ReactNode; sub?: ReactNode; className?: string; big?: boolean }) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      <div className={`num mt-1 ${big ? "text-3xl" : "text-lg"} leading-none text-cream`}>{value}</div>
      {sub && <div className="num mt-1 text-[11px] text-mute">{sub}</div>}
    </div>
  );
}

/** Thin horizontal gauge, e.g. drawdown depth or Sharpe vs a scale. */
export function Gauge({ value, max, color = "var(--color-cream)", className = "" }: { value: number; max: number; color?: string; className?: string }) {
  const w = Math.max(0, Math.min(1, Math.abs(value) / max)) * 100;
  return (
    <div className={`h-[3px] w-full bg-line ${className}`}>
      <div className="h-full transition-[width] duration-700" style={{ width: `${w}%`, background: color }} />
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`border border-line bg-ink-2 ${className}`}>{children}</section>;
}

export function Chip({ children, tone = "mute", className = "" }: { children: ReactNode; tone?: "mute" | "signal" | "gain" | "loss" | "volt"; className?: string }) {
  const t = {
    mute: "border-line text-mute",
    signal: "border-signal/40 text-signal",
    gain: "border-gain/30 text-gain",
    loss: "border-loss/30 text-loss",
    volt: "border-volt/30 text-volt",
  }[tone];
  return <span className={`inline-flex items-center gap-1 border px-1.5 py-0.5 num text-[10px] uppercase tracking-wider ${t} ${className}`}>{children}</span>;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-ink-3 ${className}`} />;
}

export function Perf({ className = "" }: { className?: string }) {
  return <div className={`perf-x text-ink ${className}`} />;
}
