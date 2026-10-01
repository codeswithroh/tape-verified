"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, PieChart, SlidersHorizontal, Plus, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { ConnectButton, FaucetButton, NetworkSwitch, useUsdgBalance } from "./Wallet";
import { Logo } from "@/components/ui/Logo";
import { fmtUsd } from "@/lib/format";
import { usePrices } from "@/hooks/useTape";
import { useNetwork } from "@/components/Providers";
import { CHAINS } from "@/lib/chains";
import { DEPLOYMENTS } from "@/lib/contracts";

const NAV = [
  { href: "/app", label: "Discover", icon: Compass, exact: true },
  { href: "/app/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/app/manage", label: "Manage", icon: SlidersHorizontal },
  { href: "/app/create", label: "Launch vault", icon: Plus },
];

function Ticker() {
  const { data } = usePrices();
  if (!data) return <div className="h-full" />;
  const rows = Object.entries(data).filter(([s]) => s !== "USDG");
  const item = (s: string, p: number, k: string) => (
    <span key={k} className="flex items-center gap-2 px-4">
      <span className="text-mute">{s}</span>
      <span className="text-cream">{p.toFixed(2)}</span>
    </span>
  );
  return (
    <div className="relative h-full overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
      <div className="flex h-full w-max animate-marquee items-center num text-[11px]">
        {rows.map(([s, p]) => item(s, p.price, s))}
        {rows.map(([s, p]) => item(s, p.price, s + "2"))}
      </div>
    </div>
  );
}

function ContractsLink() {
  const { chainId } = useNetwork();
  const url = CHAINS.find((c) => c.id === chainId)?.blockExplorers?.default.url;
  return (
    <a href={`${url}/address/${DEPLOYMENTS[chainId].factory}`} target="_blank" className="text-dim hover:text-mute" title="Contracts on explorer">
      <ArrowUpRight size={16} />
    </a>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const bal = useUsdgBalance();
  return (
    <div className="grain min-h-screen bg-ink text-cream">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[76px] flex-col items-center border-r border-line bg-ink py-5 md:flex">
        <Link href="/" className="mb-8" title="Tape home">
          <Logo size={30} />
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const on = exact ? path === href || path.startsWith("/app/v/") : path.startsWith(href);
            return (
              <Link key={href} href={href} title={label} className={`group relative grid h-12 w-12 place-items-center transition-colors ${on ? "text-cream" : "text-dim hover:text-mute"}`}>
                {on && <span className="absolute -left-[14px] h-6 w-[3px] bg-signal" />}
                <Icon size={19} strokeWidth={1.6} />
                <span className="pointer-events-none absolute left-14 whitespace-nowrap border border-line bg-ink-2 px-2 py-1 text-[11px] opacity-0 transition-opacity group-hover:opacity-100">{label}</span>
              </Link>
            );
          })}
        </nav>
        <ContractsLink />
      </aside>

      <header className="sticky top-0 z-20 flex h-12 items-center gap-3 border-b border-line bg-ink/85 pl-4 pr-3 backdrop-blur md:pl-[92px]">
        <Link href="/" className="md:hidden">
          <Logo size={24} />
        </Link>
        <div className="hidden min-w-0 flex-1 sm:block">
          <Ticker />
        </div>
        <div className="ml-auto flex items-center gap-2">
          {bal !== null && <span className="hidden num text-xs text-mute lg:inline">{fmtUsd(bal)} <span className="text-dim">USDG</span></span>}
          <FaucetButton />
          <NetworkSwitch />
          <ConnectButton />
        </div>
      </header>

      <main className="px-4 pb-24 pt-6 md:pl-[100px] md:pr-8">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-ink md:hidden">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const on = exact ? path === href : path.startsWith(href);
          return (
            <Link key={href} href={href} className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] ${on ? "text-signal" : "text-dim"}`}>
              <Icon size={18} strokeWidth={1.6} />
              {label.split(" ")[0]}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
