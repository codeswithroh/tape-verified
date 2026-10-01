"use client";
import { useVaults, usePrices } from "@/hooks/useTape";
import { fmtPct, fmtUsd } from "@/lib/format";

export function LiveMarquee() {
  const { data } = usePrices();
  const rows = Object.entries(data ?? {}).filter(([s]) => s !== "USDG");
  const item = (s: string, p: number, k: string) => (
    <span key={k} className="flex items-center gap-3 px-6">
      <span className="text-paper/50">{s}</span>
      <span>{p.toFixed(2)}</span>
      <span className="text-signal">◆</span>
    </span>
  );
  return (
    <div className="overflow-hidden border-y border-ink bg-ink py-3 text-paper">
      <div className="flex w-max animate-marquee num text-sm">
        {rows.length === 0 && <span className="px-6 text-paper/40">connecting to Robinhood Chain…</span>}
        {rows.map(([s, p]) => item(s, p.price, s))}
        {rows.map(([s, p]) => item(s, p.price, s + "b"))}
      </div>
    </div>
  );
}

export function LiveStats() {
  const { data } = useVaults();
  const vs = data?.vaults ?? [];
  const stats = [
    ["vaults on the tape", vs.length ? String(vs.length) : "—"],
    ["checkpoints stamped", vs.length ? String(vs.reduce((a, v) => a + v.metrics.n, 0)) : "—"],
    ["value copied", vs.length ? fmtUsd(vs.reduce((a, v) => a + v.value, 0), true) : "—"],
  ];
  return (
    <div className="grid grid-cols-3 divide-x divide-ink/15 border-y border-ink/15">
      {stats.map(([l, v]) => (
        <div key={l} className="px-4 py-6 md:px-8">
          <div className="num text-3xl md:text-5xl">{v}</div>
          <div className="num mt-2 text-[10px] uppercase tracking-[0.18em] text-ink/50">{l}</div>
        </div>
      ))}
    </div>
  );
}

/** A real vault, read live from chain, printed as a receipt. */
export function LiveReceipt() {
  const { data } = useVaults();
  const v = [...(data?.vaults ?? [])].sort((a, b) => b.sharpeAnn - a.sharpeAnn)[0];
  const pts = v?.series ?? [];
  const W = 260, H = 70;
  const vals = pts.map((p) => p.pps);
  const min = Math.min(...vals), max = Math.max(...vals);
  const d = vals.map((x, i) => `${i ? "L" : "M"}${((i / Math.max(1, vals.length - 1)) * W).toFixed(1)},${(H - 4 - ((x - min) / (max - min || 1)) * (H - 8)).toFixed(1)}`).join("");
  const rows = pts.slice(-7).reverse();
  return (
    <div className="relative w-[300px] rotate-[2.5deg] bg-[#fbf8f1] px-5 pb-6 pt-5 text-ink shadow-[0_30px_60px_-20px_rgba(14,14,12,0.45)]">
      <div className="perf-x absolute -top-2 left-0 right-0 text-[#fbf8f1]" style={{ transform: "scaleY(-1)" }} />
      <div className="flex items-start justify-between">
        <div>
          <div className="num text-[9px] uppercase tracking-[0.2em] text-ink/50">tape · live from chain</div>
          <div className="mt-1 font-serif text-2xl leading-none">{v?.name ?? "Loading…"}</div>
        </div>
        <span className="num border border-[#0c7a43] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-[#0c7a43]">verified</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full">
        <path d={d} fill="none" stroke="#0e0e0c" strokeWidth="1.4" />
      </svg>
      <div className="mt-3 grid grid-cols-3 gap-2 border-y border-dashed border-ink/25 py-2 num text-[11px]">
        <div><div className="text-ink/45">RETURN</div>{v ? fmtPct(v.metrics.totalReturn) : "—"}</div>
        <div><div className="text-ink/45">MAX DD</div>{v ? fmtPct(-v.metrics.maxDrawdown) : "—"}</div>
        <div><div className="text-ink/45">SHARPE</div>{v ? v.sharpeAnn.toFixed(2) : "—"}</div>
      </div>
      <div className="mt-2 space-y-1 num text-[10px]">
        {rows.map((p) => (
          <div key={p.i} className="flex justify-between">
            <span className="text-ink/45">#{String(p.i).padStart(3, "0")} {p.date?.slice(5) ?? ""}</span>
            <span>{p.pps.toFixed(4)}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 text-center num text-[9px] uppercase tracking-[0.25em] text-ink/40">append-only · stylus engine</div>
      <div className="perf-x absolute -bottom-2 left-0 right-0 text-[#fbf8f1]" />
    </div>
  );
}
