"use client";
import { useAccount, useConnect, useDisconnect, useSwitchChain, useWriteContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { Droplets, LogOut, Wallet as WalletIcon } from "lucide-react";
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

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const mounted = useMounted();
  if (!mounted) return <div className="h-8 w-32" />;
  if (isConnected && address)
    return (
      <button onClick={() => disconnect()} className="group flex items-center gap-2 border border-line px-2 py-1 transition-colors hover:border-line-2">
        <Identicon address={address} size={20} />
        <span className="num text-xs text-cream">{short(address)}</span>
        <LogOut size={12} className="text-dim group-hover:text-loss" />
      </button>
    );
  return (
    <button
      onClick={() => connect({ connector: connectors[0] })}
      disabled={isPending}
      className="flex items-center gap-2 bg-signal px-3 py-1.5 text-xs font-medium text-ink transition-transform hover:-translate-y-px active:translate-y-0"
    >
      <WalletIcon size={14} /> {isPending ? "Connecting" : "Connect"}
    </button>
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
