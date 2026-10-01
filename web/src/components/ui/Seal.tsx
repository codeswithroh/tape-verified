/** Rotating verification seal: the brand mark of an on-chain track record. */
export function Seal({ size = 88, label = "VERIFIED ON-CHAIN · STYLUS ENGINE · ", spin = true, className = "" }: { size?: number; label?: string; spin?: boolean; className?: string }) {
  const r = 38;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-label="Verified on-chain">
      <defs>
        <path id="sealpath" d={`M50,50 m-${r},0 a${r},${r} 0 1,1 ${r * 2},0 a${r},${r} 0 1,1 -${r * 2},0`} />
      </defs>
      <g className={spin ? "origin-center animate-[spin_24s_linear_infinite]" : ""} style={{ transformBox: "fill-box" }}>
        <text fontSize="8.4" letterSpacing="1.6" fill="currentColor" fontFamily="var(--font-mono)">
          <textPath href="#sealpath">{label.repeat(2)}</textPath>
        </text>
      </g>
      <circle cx="50" cy="50" r="27" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M38 51 l8 8 l16 -18" fill="none" stroke="var(--color-signal)" strokeWidth="5" strokeLinecap="square" />
    </svg>
  );
}
