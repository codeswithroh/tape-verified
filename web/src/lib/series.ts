/** Running maximum of a series (pure; safe to call during render). */
export function runningMax(xs: number[]): number[] {
  const out: number[] = [];
  let m = -Infinity;
  for (const x of xs) {
    m = Math.max(m, x);
    out.push(m);
  }
  return out;
}

/** Cumulative offsets for segments laid end to end. */
export function offsets(xs: number[]): number[] {
  const out: number[] = [];
  let acc = 0;
  for (const x of xs) {
    out.push(acc);
    acc += x;
  }
  return out;
}
