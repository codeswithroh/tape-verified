"use client";
import { ASSET_META } from "@/lib/contracts";
import type { Holding } from "@/hooks/useTape";

export function AllocationBar({ holdings, height = 8, legend = false }: { holdings: Holding[]; height?: number; legend?: boolean }) {
  const hs = holdings.filter((h) => h.weight > 0.002).sort((a, b) => b.weight - a.weight);
  return (
    <div>
      <div className="flex w-full gap-px overflow-hidden" style={{ height }}>
        {hs.map((h) => (
          <div key={h.sym} title={`${h.sym} ${(h.weight * 100).toFixed(1)}%`} style={{ width: `${h.weight * 100}%`, background: ASSET_META[h.sym]?.color ?? "#777" }} className="transition-[width] duration-700" />
        ))}
      </div>
      {legend && (
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          {hs.map((h) => (
            <div key={h.sym} className="flex items-center gap-2 num text-xs">
              <span className="h-2 w-2 shrink-0" style={{ background: ASSET_META[h.sym]?.color }} />
              <span className="text-cream">{h.sym}</span>
              <span className="ml-auto text-mute">{(h.weight * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
