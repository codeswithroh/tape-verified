import { ASSET_META } from "@/lib/contracts";

export function AssetGlyph({ sym, size = 22 }: { sym: string; size?: number }) {
  const c = ASSET_META[sym]?.color ?? "#888";
  return (
    <span className="inline-grid shrink-0 place-items-center num font-semibold text-ink" style={{ width: size, height: size, background: c, fontSize: size * 0.36 }}>
      {sym.slice(0, sym.length > 3 ? 2 : sym.length === 3 ? 3 : sym.length)}
    </span>
  );
}

export function AssetStack({ syms, size = 20 }: { syms: string[]; size?: number }) {
  return (
    <span className="flex -space-x-1">
      {syms.slice(0, 5).map((s) => (
        <span key={s} className="ring-2 ring-ink-2">
          <AssetGlyph sym={s} size={size} />
        </span>
      ))}
      {syms.length > 5 && <span className="grid place-items-center bg-line num text-[9px] text-cream ring-2 ring-ink-2" style={{ width: size, height: size }}>+{syms.length - 5}</span>}
    </span>
  );
}
