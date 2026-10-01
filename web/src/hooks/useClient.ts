"use client";
import { useEffect, useState, useSyncExternalStore } from "react";

const noop = () => () => {};
/** true after hydration, false during SSR, without setState-in-effect. */
export const useMounted = () => useSyncExternalStore(noop, () => true, () => false);

/** Wall clock in seconds, ticking every `ms`. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() / 1000), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
