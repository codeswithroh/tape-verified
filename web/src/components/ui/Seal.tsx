/** Rotating verification seal: the brand mark of an on-chain track record.
 *  The ring text is stretched to exactly one revolution (textLength = circumference),
 *  so it never overlaps itself or leaves a gap, whatever the label length. */
export function Seal({ size = 88, label = "VERIFIED ON-CHAIN · STYLUS ENGINE · ", spin = true, className = "", check = "var(--color-signal)" }: { size?: number; label?: string; spin?: boolean; className?: string; check?: string }) {
  const r = 38;
  const circumference = 2 * Math.PI * r;
  // repeat short labels so the ring reads evenly; ~36 mono glyphs fit at this size
  const text = label.repeat(Math.max(1, Math.round(36 / label.length)));
  const id = `seal-${label.length}-${size}`;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={`overflow-visible ${className}`} aria-label="Verified on-chain">
      <defs>
        {/* starts at 9 o'clock, runs clockwise */}
        <path id={id} d={`M ${50 - r},50 a ${r},${r} 0 1,1 ${2 * r},0 a ${r},${r} 0 1,1 ${-2 * r},0`} />
      </defs>
      <g>
        {spin && <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="24s" repeatCount="indefinite" />}
        <text fontSize="7.6" fill="currentColor" fontFamily="var(--font-mono)" dominantBaseline="middle">
          <textPath href={`#${id}`} textLength={circumference - 2} lengthAdjust="spacing">
            {text}
          </textPath>
        </text>
      </g>
      <circle cx="50" cy="50" r="27" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M38 51 l8 8 l16 -18" fill="none" stroke={check} strokeWidth="5" strokeLinecap="square" />
    </svg>
  );
}
