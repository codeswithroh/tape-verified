import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Providers } from "@/components/Providers";
import { LiveMarquee, LiveReceipt, LiveStats } from "@/components/landing/Live";
import { Logo } from "@/components/ui/Logo";
import { Seal } from "@/components/ui/Seal";

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-paper/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center px-6">
        <Link href="/"><Logo size={26} word /></Link>
        <nav className="ml-12 hidden gap-8 text-sm text-ink/60 md:flex">
          <a href="#how" className="hover:text-ink">How it works</a>
          <a href="#guarantees" className="hover:text-ink">Guarantees</a>
          <a href="#proof" className="hover:text-ink">Proof</a>
        </nav>
        <Link href="/app" className="group ml-auto flex items-center gap-2 bg-ink px-4 py-2.5 text-sm text-paper transition-colors hover:bg-signal hover:text-ink">
          Launch app <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </header>
  );
}

function FakePost() {
  return (
    <div className="w-[290px] -rotate-[4deg] border border-ink/15 bg-white p-4 shadow-[0_20px_40px_-20px_rgba(14,14,12,0.35)]">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-300 to-pink-400" />
        <div>
          <div className="text-sm font-semibold">StockGuru_Official</div>
          <div className="text-[11px] text-ink/40">2h · 248k followers</div>
        </div>
      </div>
      <p className="mt-3 text-sm leading-snug">My portfolio is up <b>+312%</b> this quarter 🚀🚀 Copy my picks — link in bio. Not financial advice 😉</p>
      <div className="mt-3 h-20 bg-gradient-to-tr from-emerald-100 to-emerald-300 [clip-path:polygon(0_100%,15%_80%,30%_85%,50%_50%,70%_45%,85%_15%,100%_0,100%_100%)]" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[14deg] border-[3px] border-loss px-3 py-1 font-mono text-2xl font-bold tracking-widest text-loss opacity-90">
        UNVERIFIED
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="ledger absolute inset-0 opacity-70" />
      <div className="relative mx-auto grid max-w-[1280px] gap-12 px-6 pb-20 pt-16 md:pt-24 lg:grid-cols-[1.15fr_1fr]">
        <div className="animate-rise">
          <div className="num inline-flex items-center gap-2 border border-ink/20 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-ink/60">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-signal" /> Live on Robinhood Chain testnet
          </div>
          <h1 className="mt-8 font-serif text-[clamp(3.4rem,8vw,7.4rem)] leading-[0.9] tracking-[-0.02em]">
            Returns you
            <br />
            can&apos;t{" "}
            <span className="relative inline-block italic">
              fake.
              <span className="absolute -left-3 -right-4 top-[54%] h-[0.32em] -rotate-2 bg-signal mix-blend-multiply" />
            </span>
          </h1>
          <p className="mt-8 max-w-[34rem] text-lg leading-relaxed text-ink/70">
            Copy stock portfolios whose every trade and every return is stamped on-chain. No screenshots. No trust. Just the tape.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link href="/app" className="group flex items-center gap-3 bg-ink px-6 py-4 text-paper transition-colors hover:bg-signal hover:text-ink">
              Explore verified portfolios <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/app/create" className="flex items-center gap-2 border-b border-ink/30 pb-1 text-sm hover:border-ink">
              I manage money <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="mt-12 flex flex-wrap gap-x-8 gap-y-2 num text-[11px] uppercase tracking-[0.16em] text-ink/45">
            <span>Settled in USDG</span>
            <span>Priced by Chainlink</span>
            <span>Scored by Arbitrum Stylus</span>
          </div>
        </div>

        <div className="relative hidden min-h-[520px] lg:block">
          <div className="absolute left-0 top-10 animate-rise [animation-delay:200ms]">
            <div className="relative"><FakePost /></div>
          </div>
          <div className="absolute right-0 top-0 animate-rise [animation-delay:450ms]">
            <LiveReceipt />
          </div>
          <Seal size={120} className="absolute bottom-6 left-24 text-ink animate-rise [animation-delay:700ms]" />
        </div>
      </div>
    </section>
  );
}

function Problem() {
  const items = [
    { k: "India", h: "A regulator built an agency just to check returns.", b: "SEBI bars unregistered finfluencers from return claims and launched PaRRVA to verify past performance." },
    { k: "Singapore", h: "“Not financial advice” is no longer a shield.", b: "MAS rules on digital advertising now reach the content creators who promote financial products." },
    { k: "Robinhood", h: "Verified, copyable trades exist, inside one US app.", b: "Robinhood Social verifies trades for US users. Stock Tokens reach 120+ countries that app does not." },
  ];
  return (
    <section className="mx-auto max-w-[1280px] px-6 py-24">
      <div className="grid gap-12 lg:grid-cols-[320px_1fr]">
        <h2 className="font-serif text-5xl leading-[0.95]">
          The world wants <span className="italic">proof</span>.
        </h2>
        <div className="grid gap-px bg-ink/15 md:grid-cols-3">
          {items.map((it) => (
            <div key={it.k} className="bg-paper p-6">
              <div className="num text-[11px] uppercase tracking-[0.18em] text-signal">{it.k}</div>
              <div className="mt-4 font-serif text-2xl leading-tight">{it.h}</div>
              <p className="mt-4 text-sm leading-relaxed text-ink/60">{it.b}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function How() {
  const steps = [
    {
      n: "01",
      t: "Managers trade in the open",
      b: "A vault holds Robinhood Stock Tokens and USDG. Every swap must fill within a band of the Chainlink price. There is no withdraw button for the manager.",
      art: (
        <svg viewBox="0 0 200 90" className="w-full">
          <rect x="10" y="20" width="60" height="50" fill="none" stroke="currentColor" />
          <rect x="130" y="20" width="60" height="50" fill="none" stroke="currentColor" />
          <path d="M72 38 H128 M120 32 l8 6 -8 6 M128 54 H72 M80 48 l-8 6 8 6" fill="none" stroke="var(--color-signal)" strokeWidth="2" />
          <text x="40" y="49" textAnchor="middle" fontSize="11" className="num" fill="currentColor">USDG</text>
          <text x="160" y="49" textAnchor="middle" fontSize="11" className="num" fill="currentColor">NVDA</text>
        </svg>
      ),
    },
    {
      n: "02",
      t: "Rust on Stylus stamps the tape",
      b: "Each checkpoint appends the net-of-fee share price to an append-only record. Return, drawdown, volatility and Sharpe are computed on-chain.",
      art: (
        <svg viewBox="0 0 200 90" className="w-full">
          <rect x="0" y="30" width="200" height="30" fill="var(--color-signal)" />
          {Array.from({ length: 14 }).map((_, i) => (
            <rect key={i} x={10 + i * 13.5} y={i % 4 === 0 ? 34 : 40} width="2" height={i % 4 === 0 ? 22 : 10} fill="var(--color-ink)" />
          ))}
        </svg>
      ),
    },
    {
      n: "03",
      t: "Copy with USDG. Leave anytime.",
      b: "Deposit to mirror the portfolio at oracle NAV. Exit in kind, pro-rata, with no oracle and no manager needed, even on a weekend.",
      art: (
        <svg viewBox="0 0 200 90" className="w-full">
          <circle cx="45" cy="45" r="26" fill="none" stroke="currentColor" />
          <circle cx="155" cy="45" r="26" fill="none" stroke="currentColor" strokeDasharray="3 4" />
          <path d="M75 45 H125 M117 39 l8 6 -8 6" fill="none" stroke="var(--color-signal)" strokeWidth="2" />
          <text x="45" y="49" textAnchor="middle" fontSize="11" className="num" fill="currentColor">YOU</text>
          <text x="155" y="49" textAnchor="middle" fontSize="11" className="num" fill="currentColor">VAULT</text>
        </svg>
      ),
    },
  ];
  return (
    <section id="how" className="scroll-mt-16 bg-ink py-24 text-paper">
      <div className="mx-auto max-w-[1280px] px-6">
        <div className="flex items-end justify-between gap-6">
          <h2 className="font-serif text-5xl leading-[0.95] md:text-6xl">How the tape works</h2>
          <span className="num hidden text-[11px] uppercase tracking-[0.18em] text-paper/40 md:block">three contracts · one engine</span>
        </div>
        <div className="mt-16 grid gap-px bg-paper/10 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="bg-ink p-8">
              <div className="num text-sm text-signal">{s.n}</div>
              <div className="mt-8 text-paper/80">{s.art}</div>
              <div className="mt-8 font-serif text-3xl leading-tight">{s.t}</div>
              <p className="mt-4 text-sm leading-relaxed text-paper/55">{s.b}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Guarantees() {
  const g = [
    ["Manager can't take the money", "trade() is the only manager action. USDG ↔ listed stock tokens, nothing else."],
    ["Manager can't trade at a bad price", "Fills measured by balance diff. Hard cap 150 bps from Chainlink."],
    ["You can always leave", "In-kind redemption reads no oracle. Weekends, outages, absent managers."],
    ["Track record can't be padded", "Deposits and withdrawals never move share price. Invariant-tested."],
    ["Fees only on new highs", "Performance fee minted only above the high-water mark."],
    ["Stale prices can't price you in", "Deposits halt when a held asset's feed goes stale."],
  ];
  return (
    <section id="guarantees" className="scroll-mt-16 mx-auto max-w-[1280px] px-6 py-24">
      <h2 className="max-w-2xl font-serif text-5xl leading-[0.95] md:text-6xl">
        Trust a stranger&apos;s vault, <span className="italic">because you don&apos;t have to.</span>
      </h2>
      <div className="mt-14 grid gap-px border border-ink/15 bg-ink/15 sm:grid-cols-2 lg:grid-cols-3">
        {g.map(([h, b], i) => (
          <div key={h} className="group bg-paper p-7 transition-colors hover:bg-[#fbf8f1]">
            <div className="num text-[11px] text-ink/35">{String(i + 1).padStart(2, "0")}</div>
            <div className="mt-6 text-xl font-medium leading-snug">{h}</div>
            <p className="mt-3 num text-xs leading-relaxed text-ink/55">{b}</p>
            <div className="mt-6 h-[3px] w-8 bg-signal transition-all duration-500 group-hover:w-full" />
          </div>
        ))}
      </div>
    </section>
  );
}

function Proof() {
  return (
    <section id="proof" className="scroll-mt-16 border-t border-ink/10 py-24">
      <div className="mx-auto max-w-[1280px] px-6">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="font-serif text-5xl leading-[0.95] md:text-6xl">Same code. Real market.</h2>
            <p className="mt-6 max-w-md text-ink/65">
              The contracts deployed on testnet were also run against Robinhood Chain mainnet: real USDG, real NVDA, AAPL and TSLA tokens, real Chainlink feeds, real Uniswap pools.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-px bg-ink/15">
            {[
              ["19 bps", "execution cost vs oracle, $18k across three real pools"],
              ["31", "Foundry tests: unit, fuzz, invariant"],
              ["8,192", "random calls per invariant run"],
              ["13.4 KB", "Stylus engine, deployed on two chains"],
            ].map(([n, l]) => (
              <div key={n} className="bg-paper p-6">
                <div className="num text-4xl">{n}</div>
                <div className="mt-3 text-sm text-ink/55">{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-16">
          <LiveStats />
        </div>
      </div>
    </section>
  );
}

function Stack() {
  const s = ["Robinhood Chain", "Arbitrum Stylus", "Paxos USDG", "Chainlink", "Uniswap v3"];
  return (
    <section className="border-y border-ink/10 py-10">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-6 px-6">
        <span className="num text-[11px] uppercase tracking-[0.18em] text-ink/40">Built on</span>
        {s.map((x) => (
          <span key={x} className="font-serif text-2xl text-ink/70">{x}</span>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-signal py-28 text-ink">
      <div className="mx-auto max-w-[1280px] px-6">
        <h2 className="font-serif text-[clamp(3rem,7vw,6.5rem)] leading-[0.9]">
          Stop trusting
          <br />
          <span className="italic">screenshots.</span>
        </h2>
        <Link href="/app" className="group mt-12 inline-flex items-center gap-3 bg-ink px-7 py-4 text-paper">
          Launch Tape <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
      <Seal size={260} className="absolute -bottom-16 right-8 text-ink/80" />
    </section>
  );
}

export default function Landing() {
  return (
    <Providers>
      <div className="grain min-h-screen bg-paper text-ink">
        <Nav />
        <Hero />
        <LiveMarquee />
        <Problem />
        <How />
        <Guarantees />
        <Stack />
        <Proof />
        <FinalCta />
        <footer className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-8 num text-[11px] text-ink/40">
          <Logo size={18} word />
          <span>Testnet build · Arbitrum Open House Singapore</span>
        </footer>
      </div>
    </Providers>
  );
}
