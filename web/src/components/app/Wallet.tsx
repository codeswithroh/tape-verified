"use client";
import { useAccount, useConnect, useDisconnect, useSwitchChain, useWriteContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { Droplets, LogOut, Wallet as WalletIcon, Zap } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMounted } from "@/hooks/useClient";
import { useNetwork } from "@/components/Providers";
import { CHAINS, CHAIN_META, type SupportedChainId } from "@/lib/chains";
import { abi, DEPLOYMENTS } from "@/lib/contracts";
import { short } from "@/lib/format";
import { Identicon } from "@/components/ui/Identicon";
import { publicClient } from "@/lib/wagmi";

export function NetworkSwitch() {
  const { chainId, setChainId } = useNetwork();
  const { isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  return (
    <div className="flex border border-line num text-[11px]">
      {CHAINS.map((c) => {
        const on = c.id === chainId;
        return (
          <button
            key={c.id}
            onClick={() => {
              setChainId(c.id as SupportedChainId);
              if (isConnected) switchChain({ chainId: c.id });
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 uppercase tracking-wider transition-colors ${on ? "bg-ink-3 text-cream" : "text-dim hover:text-mute"}`}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: on ? CHAIN_META[c.id as SupportedChainId].dot : "var(--color-dim)" }} />
            {CHAIN_META[c.id as SupportedChainId].short}
          </button>
        );
      })}
    </div>
  );
}

/** Make sure the wallet is on the app's selected chain before writing. */
export function useEnsureChain() {
  const { chainId } = useNetwork();
  const { chainId: walletChain } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  return async () => {
    if (walletChain !== chainId) await switchChainAsync({ chainId });
  };
}

export function FaucetButton() {
  const { chainId } = useNetwork();
  const { address } = useAccount();
  const qc = useQueryClient();
  const ensure = useEnsureChain();
  const { writeContractAsync, isPending } = useWriteContract();
  const [done, setDone] = useState(false);
  if (!address) return null;
  return (
    <button
      disabled={isPending}
      onClick={async () => {
        await ensure();
        const hash = await writeContractAsync({ address: DEPLOYMENTS[chainId].usdg, abi: abi.erc20, functionName: "faucet", chainId });
        await publicClient(chainId).waitForTransactionReceipt({ hash });
        qc.invalidateQueries();
        setDone(true);
        setTimeout(() => setDone(false), 2500);
      }}
      title="Mint 10,000 test USDG"
      className="flex items-center gap-1.5 border border-line px-2.5 py-1.5 num text-[11px] uppercase tracking-wider text-mute transition-colors hover:border-signal hover:text-signal disabled:opacity-50"
    >
      <Droplets size={13} />
      {isPending ? "…" : done ? "+10k" : "USDG"}
    </button>
  );
}

type Funding = "idle" | "gas" | "usdg" | "ready" | "error";

/** After connecting the demo wallet: top up gas from /api/drip, then mint test USDG once. */
function useFundDemo() {
  const { chainId } = useNetwork();
  const qc = useQueryClient();
  const { writeContractAsync } = useWriteContract();
  const [state, setState] = useState<Funding>("idle");
  async function fund(address: `0x${string}`) {
    try {
      setState("gas");
      const r = await fetch("/api/drip", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address, chain: chainId }) }).then((x) => x.json());
      if (!r.ok && r.error !== "slow down") throw new Error(r.error);
      const pc = publicClient(chainId);
      const bal = await pc.readContract({ address: DEPLOYMENTS[chainId].usdg, abi: abi.erc20, functionName: "balanceOf", args: [address] });
      if (bal < 1_000_000_000n) {
        setState("usdg");
        const hash = await writeContractAsync({ address: DEPLOYMENTS[chainId].usdg, abi: abi.erc20, functionName: "faucet", chainId });
        await pc.waitForTransactionReceipt({ hash });
      }
      qc.invalidateQueries();
      setState("ready");
      setTimeout(() => setState("idle"), 2500);
    } catch {
      setState("error");
    }
  }
  return { state, fund };
}

export function ConnectButton() {
  const { address, isConnected, connector } = useAccount();
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { chainId } = useNetwork();
  const mounted = useMounted();
  const [open, setOpen] = useState(false);
  const demo = useFundDemo();
  if (!mounted) return <div className="h-8 w-32" />;

  if (isConnected && address)
    return (
      <div className="flex items-center gap-2">
        {demo.state !== "idle" && (
          <span className={`num text-[11px] ${demo.state === "error" ? "text-loss" : "text-signal"}`}>
            {demo.state === "gas" ? "funding gas…" : demo.state === "usdg" ? "minting USDG…" : demo.state === "ready" ? "ready" : "funding failed"}
          </span>
        )}
        <button
          onClick={() => {
            try {
              localStorage.removeItem("tape:demo-on");
            } catch {}
            disconnect();
          }}
          className="group flex items-center gap-2 border border-line px-2 py-1 transition-colors hover:border-line-2">
          <Identicon address={address} size={20} />
          <span className="num text-xs text-cream">{short(address)}</span>
          {connector?.id === "tape-demo" && <span className="num text-[9px] uppercase tracking-wider text-volt">demo</span>}
          <LogOut size={12} className="text-dim group-hover:text-loss" />
        </button>
      </div>
    );

  const browser = connectors.find((c) => c.id === "injected");
  const demoC = connectors.find((c) => c.id === "tape-demo");
  const hasBrowserWallet = typeof window !== "undefined" && !!(window as unknown as { ethereum?: unknown }).ethereum;

  async function useDemo() {
    setOpen(false);
    const r = await connectAsync({ connector: demoC!, chainId });
    await demo.fund(r.accounts[0]);
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} disabled={isPending} className="flex items-center gap-2 bg-signal px-3 py-1.5 text-xs font-medium text-ink transition-transform hover:-translate-y-px active:translate-y-0">
        <WalletIcon size={14} /> {isPending ? "Connecting" : "Connect"}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-64 border border-line-2 bg-ink-2 p-1 shadow-2xl">
          <button onClick={useDemo} className="flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-ink-3">
            <Zap size={16} className="mt-0.5 shrink-0 text-volt" />
            <span>
              <span className="block text-sm text-cream">Demo wallet</span>
              <span className="num block text-[10px] text-dim">instant · gas + 10k USDG included</span>
            </span>
          </button>
          <button
            disabled={!hasBrowserWallet}
            onClick={() => (setOpen(false), connectAsync({ connector: browser!, chainId }).catch(() => {}))}
            className="flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-ink-3 disabled:opacity-40"
          >
            <WalletIcon size={16} className="mt-0.5 shrink-0 text-mute" />
            <span>
              <span className="block text-sm text-cream">Browser wallet</span>
              <span className="num block text-[10px] text-dim">{hasBrowserWallet ? "MetaMask, Rabby…" : "none detected"}</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

export function useUsdgBalance(): number | null {
  const { chainId } = useNetwork();
  const { address } = useAccount();
  const { data } = useQuery({
    enabled: !!address,
    queryKey: ["usdg", chainId, address],
    queryFn: async () => Number(await publicClient(chainId).readContract({ address: DEPLOYMENTS[chainId].usdg, abi: abi.erc20, functionName: "balanceOf", args: [address!] })) / 1e6,
    refetchInterval: 10_000,
  });
  return address ? data ?? null : null;
}
