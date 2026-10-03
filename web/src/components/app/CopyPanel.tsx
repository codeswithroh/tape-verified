"use client";
import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { ArrowDownToLine, ArrowUpFromLine, Check, Loader2 } from "lucide-react";
import type { Vault } from "@/hooks/useTape";
import { useNetwork } from "@/components/Providers";
import { useTxFlow } from "@/hooks/useTx";
import { useEnsureChain, useUsdgBalance, ConnectButton } from "./Wallet";
import { abi, DEPLOYMENTS } from "@/lib/contracts";
import { fmtNum, fmtUsd } from "@/lib/format";
import { AssetGlyph } from "@/components/ui/AssetChip";
import { Label, Panel } from "@/components/ui/bits";
import { publicClient } from "@/lib/wagmi";

const ENTRY_FEE = 0.002;

function TxLabel({ state, idle, step, steps }: { state: string; idle: string; step: number; steps: string[] }) {
  if (state === "signing") return <><Loader2 size={15} className="animate-spin" /> Sign {steps[step]}</>;
  if (state === "confirming") return <><Loader2 size={15} className="animate-spin" /> {steps[step]}…</>;
  if (state === "done") return <><Check size={15} /> Done</>;
  return <>{idle}</>;
}

export function CopyPanel({ v }: { v: Vault }) {
  const { chainId } = useNetwork();
  const { address } = useAccount();
  const [mode, setMode] = useState<"copy" | "exit">("copy");
  const [amount, setAmount] = useState("");
  const [frac, setFrac] = useState(100);
  const bal = useUsdgBalance();
  const ensure = useEnsureChain();
  const { writeContractAsync } = useWriteContract();
  const flow = useTxFlow();
  const dep = DEPLOYMENTS[chainId];

  const { data: sharesRaw, refetch } = useReadContract({ address: v.address, abi: abi.vault, functionName: "balanceOf", args: address ? [address] : undefined, chainId, query: { enabled: !!address } });
  useEffect(() => { if (flow.state === "done") refetch(); }, [flow.state, refetch]);
  const shares = Number(sharesRaw ?? 0n) / 1e18;
  const share = v.supply ? shares / v.supply : 0;
  const myValue = share * v.value;

  const amt = Number(amount) || 0;
  const estShares = v.pps ? (amt * (1 - ENTRY_FEE)) / v.pps : 0;
  const exitParts = useMemo(() => v.holdings.map((h) => ({ ...h, out: h.amount * share * (frac / 100) })).filter((h) => h.out > 0), [v.holdings, share, frac]);

  async function copy() {
    if (!address || amt <= 0) return;
    const raw = BigInt(Math.floor(amt * 1e6));
    const minShares = BigInt(Math.floor(estShares * 0.99 * 1e18));
    await flow.run([
      async () => {
        await ensure();
        const allowance = await publicClient(chainId).readContract({ address: dep.usdg, abi: abi.erc20, functionName: "allowance", args: [address, v.address] });
        if (allowance >= raw) return null;
        return writeContractAsync({ address: dep.usdg, abi: abi.erc20, functionName: "approve", args: [v.address, raw], chainId });
      },
      () => writeContractAsync({ address: v.address, abi: abi.vault, functionName: "deposit", args: [raw, minShares, address], chainId }),
    ]);
    setAmount("");
  }

  async function exit() {
    if (!address || !sharesRaw) return;
    const s = frac === 100 ? sharesRaw : (sharesRaw * BigInt(frac)) / 100n;
    await flow.run([
      async () => {
        await ensure();
        return writeContractAsync({ address: v.address, abi: abi.vault, functionName: "redeem", args: [s, address], chainId });
      },
    ]);
  }

  const busy = flow.state === "signing" || flow.state === "confirming";

  return (
    <Panel>
      <div className="grid grid-cols-2 border-b border-line">
        {(["copy", "exit"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`flex items-center justify-center gap-2 py-3 text-sm transition-colors ${mode === m ? "bg-ink-3 text-cream" : "text-dim hover:text-mute"}`}>
            {m === "copy" ? <ArrowDownToLine size={15} /> : <ArrowUpFromLine size={15} />}
            {m === "copy" ? "Copy" : "Exit"}
          </button>
        ))}
      </div>

      {address && shares > 0 && (
        <div className="grid grid-cols-2 gap-4 border-b border-line px-5 py-4">
          <div>
            <Label>Your stake</Label>
            <div className="num mt-1 text-xl text-cream">{fmtUsd(myValue)}</div>
          </div>
          <div>
            <Label>Share of vault</Label>
            <div className="num mt-1 text-xl text-cream">{(share * 100).toFixed(2)}%</div>
          </div>
        </div>
      )}

      <div className="p-5">
        {!address ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="num text-xs text-dim">wallet required</div>
            <ConnectButton />
          </div>
        ) : mode === "copy" ? (
          <>
            <div className="flex items-baseline justify-between">
              <Label>Amount</Label>
              <button onClick={() => bal && setAmount(String(Math.floor(bal)))} className="num text-[11px] text-mute hover:text-cream">
                {bal !== null ? fmtNum(bal) : "—"} USDG
              </button>
            </div>
            <div className="mt-2 flex items-center border border-line-2 bg-ink focus-within:border-signal">
              <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0" inputMode="decimal" className="num w-full bg-transparent px-3 py-3 text-2xl text-cream outline-none placeholder:text-dim" />
              <span className="pr-3 num text-xs text-mute">USDG</span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1">
              {[100, 500, 1000, 5000].map((x) => (
                <button key={x} onClick={() => setAmount(String(x))} className="border border-line py-1 num text-[11px] text-mute hover:border-line-2 hover:text-cream">
                  {x >= 1000 ? `${x / 1000}k` : x}
                </button>
              ))}
            </div>

            <div className="mt-5 space-y-2 num text-xs">
              <div className="flex justify-between text-mute"><span>Shares</span><span className="text-cream">{fmtNum(estShares, 4)}</span></div>
              <div className="flex justify-between text-mute"><span>Price / share</span><span className="text-cream">{v.pps.toFixed(4)}</span></div>
              <div className="flex justify-between text-mute"><span>Entry 0.2%</span><span>{fmtUsd(amt * ENTRY_FEE)}</span></div>
              <div className="flex justify-between text-mute"><span>Perf fee</span><span>{v.feeBps / 100}% over HWM</span></div>
            </div>

            <div className="mt-4">
              <Label className="mb-2">You mirror</Label>
              <div className="flex h-7 w-full gap-px">
                {v.holdings.filter((h) => h.weight > 0.005).sort((a, b) => b.weight - a.weight).map((h) => (
                  <div key={h.sym} style={{ width: `${h.weight * 100}%` }} className="grid place-items-center overflow-hidden bg-ink-3 num text-[10px] text-mute" title={`${h.sym} ${fmtUsd(amt * h.weight)}`}>
                    {h.weight > 0.12 ? h.sym : ""}
                  </div>
                ))}
              </div>
            </div>

            <button onClick={copy} disabled={busy || amt <= 0 || (bal ?? 0) < amt} className="mt-5 flex w-full items-center justify-center gap-2 bg-signal py-3.5 font-medium text-ink transition-all hover:brightness-110 disabled:opacity-40">
              <TxLabel state={flow.state} idle={(bal ?? 0) < amt ? "Insufficient USDG" : "Copy portfolio"} step={flow.step} steps={["approval", "deposit"]} />
            </button>
          </>
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <Label>Exit</Label>
              <span className="num text-2xl text-cream">{frac}%</span>
            </div>
            <input type="range" min={1} max={100} value={frac} onChange={(e) => setFrac(Number(e.target.value))} className="tape-range mt-4 w-full" />
            {/* labels sit under the thumb's actual position (range 1-100, 14px thumb) */}
            <div className="relative mt-1 h-4">
              {[25, 50, 75, 100].map((x) => (
                <button
                  key={x}
                  onClick={() => setFrac(x)}
                  style={{ left: `calc(${(x - 1) / 99} * (100% - 14px) + 7px)`, transform: `translateX(${x === 100 ? "-100%" : "-50%"})` }}
                  className="absolute num text-[11px] text-dim hover:text-cream"
                >
                  {x}%
                </button>
              ))}
            </div>
            <Label className="mb-2 mt-5">You receive · in kind</Label>
            <div className="space-y-1.5">
              {exitParts.length === 0 && <div className="num text-xs text-dim">no position</div>}
              {exitParts.map((h) => (
                <div key={h.sym} className="flex items-center gap-2 num text-xs">
                  <AssetGlyph sym={h.sym} size={18} />
                  <span className="text-cream">{fmtNum(h.out, h.sym === "USDG" ? 2 : 4)}</span>
                  <span className="text-dim">{h.sym}</span>
                  <span className="ml-auto text-mute">{fmtUsd(h.out * (h.value / (h.amount || 1)))}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 num text-[10px] text-dim">no oracle · no manager · always open</div>
            <button onClick={exit} disabled={busy || shares <= 0} className="mt-4 flex w-full items-center justify-center gap-2 border border-cream py-3.5 font-medium text-cream transition-colors hover:bg-cream hover:text-ink disabled:opacity-30">
              <TxLabel state={flow.state} idle="Exit position" step={flow.step} steps={["redemption"]} />
            </button>
          </>
        )}
        {flow.error && <div className="mt-3 num text-xs text-loss">{flow.error}</div>}
      </div>
    </Panel>
  );
}
