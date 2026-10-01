"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { BadgeCheck, Check, Loader2, Rocket } from "lucide-react";
import type { Address } from "viem";
import { useNetwork } from "@/components/Providers";
import { usePrices } from "@/hooks/useTape";
import { useTxFlow } from "@/hooks/useTx";
import { ConnectButton, useEnsureChain, useUsdgBalance } from "@/components/app/Wallet";
import { AssetGlyph } from "@/components/ui/AssetChip";
import { Identicon } from "@/components/ui/Identicon";
import { Seal } from "@/components/ui/Seal";
import { Label, Panel } from "@/components/ui/bits";
import { abi, ASSET_META, DEPLOYMENTS } from "@/lib/contracts";
import { fmtUsd } from "@/lib/format";
import { publicClient } from "@/lib/wagmi";

function Step({ n, title, children, done }: { n: number; title: string; children: React.ReactNode; done: boolean }) {
  return (
    <div className="grid grid-cols-[36px_1fr] gap-4">
      <div className="flex flex-col items-center">
        <div className={`grid h-8 w-8 place-items-center border num text-xs transition-colors ${done ? "border-signal bg-signal text-ink" : "border-line-2 text-mute"}`}>{done ? <Check size={14} /> : n}</div>
        <div className="mt-2 w-px flex-1 bg-line" />
      </div>
      <div className="pb-8">
        <Label className="mb-3 pt-2">{title}</Label>
        {children}
      </div>
    </div>
  );
}

export default function Create() {
  const router = useRouter();
  const { chainId } = useNetwork();
  const { address } = useAccount();
  const { data: prices } = usePrices();
  const bal = useUsdgBalance() ?? 0;
  const ensure = useEnsureChain();
  const { writeContractAsync } = useWriteContract();
  const flow = useTxFlow();
  const dep = DEPLOYMENTS[chainId];

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [fee, setFee] = useState(15);
  const [seed, setSeed] = useState("100");

  const toggle = (s: string) => setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : p.length >= 8 ? p : [...p, s]));
  const seedN = Number(seed) || 0;
  const ok = name.trim().length > 1 && symbol.trim().length > 1 && picked.length > 0 && seedN >= 10 && seedN <= bal;

  async function launch() {
    if (!address) return;
    const raw = BigInt(Math.floor(seedN * 1e6));
    await flow.run([
      async () => {
        await ensure();
        const a = await publicClient(chainId).readContract({ address: dep.usdg, abi: abi.erc20, functionName: "allowance", args: [address, dep.factory] });
        if (a >= raw) return null;
        return writeContractAsync({ address: dep.usdg, abi: abi.erc20, functionName: "approve", args: [dep.factory, raw], chainId });
      },
      () =>
        writeContractAsync({
          address: dep.factory,
          abi: abi.factory,
          functionName: "createVault",
          args: [name.trim(), symbol.trim().toUpperCase(), picked.map((s) => dep.assets[s].token as Address), fee * 100, raw],
          chainId,
        }),
    ]);
    const mine = (await publicClient(chainId).readContract({ address: dep.factory, abi: abi.factory, functionName: "vaultsOf", args: [address] })) as Address[];
    if (mine.length) router.push(`/app/v/${mine.at(-1)}`);
  }
  const busy = flow.state === "signing" || flow.state === "confirming";

  return (
    <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[1fr_400px]">
      <div>
        <Step n={1} title="Identity" done={name.length > 1 && symbol.length > 1}>
          <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
            <input value={name} onChange={(e) => setName(e.target.value.slice(0, 32))} placeholder="Vault name" className="border border-line-2 bg-ink px-3 py-3 font-serif text-2xl text-cream outline-none placeholder:text-dim focus:border-signal" />
            <input value={symbol} onChange={(e) => setSymbol(e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8))} placeholder="TICKER" className="border border-line-2 bg-ink px-3 py-3 num text-lg uppercase text-cream outline-none placeholder:text-dim focus:border-signal" />
          </div>
        </Step>

        <Step n={2} title={`Universe · ${picked.length}/8`} done={picked.length > 0}>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {Object.keys(dep.assets).map((s) => {
              const on = picked.includes(s);
              return (
                <button key={s} onClick={() => toggle(s)} className={`group relative flex flex-col items-start gap-2 border p-3 text-left transition-all ${on ? "border-cream bg-ink-3" : "border-line hover:border-line-2"}`}>
                  <AssetGlyph sym={s} size={26} />
                  <div>
                    <div className="num text-xs text-cream">{s}</div>
                    <div className="num text-[10px] text-dim">{prices?.[s] ? prices[s].price.toFixed(2) : "—"}</div>
                  </div>
                  {on && <Check size={12} className="absolute right-2 top-2 text-signal" />}
                  <span className="absolute inset-x-0 bottom-0 h-[2px] opacity-0 transition-opacity group-hover:opacity-100" style={{ background: ASSET_META[s]?.color }} />
                </button>
              );
            })}
          </div>
        </Step>

        <Step n={3} title="Performance fee" done>
          <div className="flex items-center gap-6">
            <span className="num w-20 text-4xl text-cream">{fee}%</span>
            <input type="range" min={0} max={30} value={fee} onChange={(e) => setFee(Number(e.target.value))} className="tape-range flex-1" />
          </div>
          <div className="mt-2 num text-[11px] text-dim">only on gains above the high-water mark</div>
        </Step>

        <Step n={4} title="Skin in the game" done={seedN >= 10}>
          <div className="flex max-w-sm items-center border border-line-2 bg-ink focus-within:border-signal">
            <input value={seed} onChange={(e) => setSeed(e.target.value.replace(/[^0-9.]/g, ""))} className="num w-full bg-transparent px-3 py-3 text-2xl text-cream outline-none" />
            <span className="pr-3 num text-xs text-mute">USDG</span>
          </div>
          <div className="mt-2 num text-[11px] text-dim">min 10 · wallet {fmtUsd(bal)}</div>
        </Step>
      </div>

      <div className="lg:sticky lg:top-16 lg:self-start">
        <Label className="mb-3">Preview</Label>
        <Panel className="relative overflow-hidden">
          <Seal size={96} className="absolute -right-4 -top-4 text-cream/15" />
          <div className="flex items-center gap-3 p-5">
            <Identicon address={address ?? "0x"} size={40} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 truncate font-serif text-2xl leading-tight text-cream">
                {name || "Untitled"} <BadgeCheck size={16} className="shrink-0 text-signal" />
              </div>
              <div className="num text-[11px] text-dim">{(symbol || "TICKER").toUpperCase()} · {fee}% perf</div>
            </div>
          </div>
          <svg viewBox="0 0 400 80" className="w-full">
            <line x1="0" x2="400" y1="60" y2="60" stroke="var(--color-line-2)" strokeDasharray="3 5" />
            <circle cx="6" cy="60" r="4" fill="var(--color-signal)" />
            <text x="16" y="64" fontSize="10" fill="var(--color-dim)" className="num">GENESIS · 1.0000</text>
          </svg>
          <div className="border-t border-line p-5">
            <div className="flex h-3 gap-px">
              {picked.length === 0 && <div className="flex-1 bg-line" />}
              {picked.map((s) => <div key={s} className="flex-1" style={{ background: ASSET_META[s]?.color }} />)}
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {picked.map((s) => <AssetGlyph key={s} sym={s} size={20} />)}
            </div>
          </div>
          <div className="grid grid-cols-2 border-t border-line">
            <div className="border-r border-line p-4">
              <Label>Seed</Label>
              <div className="num mt-1 text-lg text-cream">{fmtUsd(seedN)}</div>
            </div>
            <div className="p-4">
              <Label>Network</Label>
              <div className="num mt-1 text-lg text-cream">{chainId === 46630 ? "Robinhood" : "Arbitrum"}</div>
            </div>
          </div>
        </Panel>
        <div className="mt-4">
          {!address ? (
            <div className="flex justify-center"><ConnectButton /></div>
          ) : (
            <button onClick={launch} disabled={!ok || busy} className="flex w-full items-center justify-center gap-2 bg-signal py-4 font-medium text-ink transition-all hover:brightness-110 disabled:opacity-40">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
              {flow.state === "signing" ? `Sign ${["approval", "launch"][flow.step]}` : flow.state === "confirming" ? "Launching…" : "Launch vault"}
            </button>
          )}
          {flow.error && <div className="mt-3 num text-xs text-loss">{flow.error}</div>}
        </div>
      </div>
    </div>
  );
}
