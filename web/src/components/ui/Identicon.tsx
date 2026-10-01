/** Deterministic 5x5 mirrored block avatar from an address. */
export function Identicon({ address, size = 28 }: { address?: string; size?: number }) {
  const hex = (address ?? "0x0").toLowerCase().replace("0x", "").padEnd(40, "0");
  const hue = parseInt(hex.slice(0, 4), 16) % 360;
  const cells: boolean[] = [];
  for (let i = 0; i < 15; i++) cells.push(parseInt(hex[i + 4], 16) % 2 === 0);
  return (
    <svg width={size} height={size} viewBox="0 0 5 5" shapeRendering="crispEdges" className="shrink-0">
      <rect width="5" height="5" fill={`hsl(${hue} 18% 14%)`} />
      {cells.map((on, i) => {
        if (!on) return null;
        const row = Math.floor(i / 3), col = i % 3;
        const fill = `hsl(${hue} 70% 62%)`;
        return (
          <g key={i}>
            <rect x={col} y={row} width="1" height="1" fill={fill} />
            <rect x={4 - col} y={row} width="1" height="1" fill={fill} />
          </g>
        );
      })}
    </svg>
  );
}
