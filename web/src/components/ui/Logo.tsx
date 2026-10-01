/** Tape mark: a strip of tape with a checkpoint notch. */
export function Logo({ size = 28, word = false, className = "" }: { size?: number; word?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <rect x="2" y="9" width="28" height="14" fill="var(--color-signal)" transform="rotate(-8 16 16)" />
        <g transform="rotate(-8 16 16)" fill="var(--color-ink)">
          <rect x="7" y="13" width="2" height="6" />
          <rect x="12" y="13" width="2" height="6" />
          <rect x="17" y="11" width="2" height="10" />
          <rect x="22" y="13" width="2" height="6" />
        </g>
      </svg>
      {word && <span className="font-serif text-[1.6em] leading-none tracking-tight">Tape</span>}
    </span>
  );
}
