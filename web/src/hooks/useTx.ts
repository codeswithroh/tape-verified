"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BaseError, ContractFunctionRevertedError } from "viem";
import { useNetwork } from "@/components/Providers";
import { publicClient } from "@/lib/wagmi";

const FRIENDLY: Record<string, string> = {
  StalePrice: "Market closed · price feed stale",
  SlippageExceeded: "Fill outside oracle band",
  InsufficientShares: "Price moved · retry",
  NotManager: "Manager only",
  CheckpointTooSoon: "Too soon since last stamp",
  DeviationTooHigh: "Band above 150 bps cap",
  BadAsset: "Asset not in this vault",
  ERC20InsufficientBalance: "Insufficient balance",
  SeedTooSmall: "Seed below 10 USDG",
};

export function explain(e: unknown): string {
  if (e instanceof BaseError) {
    const rev = e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    const name = rev?.data?.errorName;
    if (name) return FRIENDLY[name] ?? name;
    if (/User rejected|denied/i.test(e.message)) return "Rejected in wallet";
    return e.shortMessage;
  }
  return (e as Error)?.message?.slice(0, 80) ?? "Failed";
}

export type TxState = "idle" | "signing" | "confirming" | "done" | "error";

/** Runs a sequence of writes (e.g. approve then deposit), tracking a single visual state. */
export function useTxFlow() {
  const { chainId } = useNetwork();
  const qc = useQueryClient();
  const [state, setState] = useState<TxState>("idle");
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);

  async function run(steps: Array<() => Promise<`0x${string}` | null>>) {
    setError(null);
    try {
      for (let i = 0; i < steps.length; i++) {
        setStep(i);
        setState("signing");
        const h = await steps[i]();
        if (!h) continue;
        setHash(h);
        setState("confirming");
        const r = await publicClient(chainId).waitForTransactionReceipt({ hash: h });
        if (r.status !== "success") throw new Error("Transaction reverted");
      }
      setState("done");
      qc.invalidateQueries();
      setTimeout(() => setState("idle"), 3000);
    } catch (e) {
      setError(explain(e));
      setState("error");
    }
  }
  return { run, state, step, error, hash, reset: () => (setState("idle"), setError(null)) };
}
