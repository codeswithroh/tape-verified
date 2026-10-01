export const WAD = 10n ** 18n;

/** Two's-complement uint256 from the engine → signed float with 1e18 = 1.0 */
export function signedWad(x: bigint): number {
  const v = x >= 1n << 255n ? x - (1n << 256n) : x;
  return Number(v) / 1e18;
}
export const wad = (x: bigint) => Number(x) / 1e18;
export const usdg = (x: bigint) => Number(x) / 1e6;

export function fmtUsd(n: number, compact = false): string {
  if (compact && Math.abs(n) >= 1000)
    return "$" + new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function fmtPct(n: number, digits = 1, sign = true): string {
  const s = (n * 100).toFixed(digits);
  return (sign && n > 0 ? "+" : "") + s + "%";
}
export const fmtNum = (n: number, d = 2) => n.toLocaleString("en-US", { maximumFractionDigits: d });
export const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
export const tone = (n: number) => (n > 0 ? "text-gain" : n < 0 ? "text-loss" : "text-mute");
