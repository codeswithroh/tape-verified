# Tape

**Copy trading for tokenized stocks, where every return is proven on-chain. Settled in USDG on Robinhood Chain.**

Finfluencers sell returns nobody can check. India's regulator, SEBI, had to set up an agency (PaRRVA) just to verify past returns. Singapore's MAS has warned influencers about unlicensed advice. Robinhood launched verified, copyable trades (Robinhood Social) only inside its US app. Robinhood Stock Tokens, though, are sold in 120+ countries where that app isn't available.

On Tape, the chain is the verification agency:

- **Public portfolio vault.** A manager runs a portfolio of Robinhood Stock Tokens and USDG. Every trade goes through the vault, so nothing can be hidden, backdated or cherry-picked.
- **Track record engine (Rust on Arbitrum Stylus).** Every checkpoint appends the vault's net-of-fee share price to an append-only tape keyed to the vault. Total return, max drawdown, volatility and Sharpe are computed on-chain, so any contract can gate on them.
- **Copy in one click.** Followers deposit USDG and receive shares at oracle NAV. They can redeem at any time, pro-rata and in kind.

## Why followers can trust a stranger's vault

| Guarantee | How it is enforced |
|---|---|
| Manager cannot take the money | The only manager action is `trade`, and only between USDG and the vault's fixed asset list, through the registry's router. There is no withdraw path for the manager. |
| Manager cannot trade at a bad price | Each fill is measured by balance diff and must land within `maxDevBps` of Chainlink. The cap is a hard 150 bps; a typical setting is 50. |
| Followers can always leave | `redeem` is pro-rata in kind and reads no oracle. It works on weekends, during feed outages, and if the manager vanishes. |
| The track record can't be faked | Only market moves, trades and fees move share price. Deposits and redemptions cannot move it (invariant-tested). Entry fees go to a treasury, never into the vault, so churn can't pad returns. |
| Fees only on real gains | The performance fee is minted as shares, only above the high-water mark. Tested: a recovery after a drawdown pays nothing. |
| Stale prices don't price deposits | Deposits, trades and checkpoints revert if any held asset's feed is older than `maxStaleness`. Robinhood stock feeds run 24/5. |

## Architecture

```
            USDG                         Uniswap v3 SwapRouter02 (mainnet)
 follower ───────► TapeVault ──trade──►  MockSwapRouter (testnet, same ABI)
     ▲  redeem in kind │  │
     └─────────────────┘  │ checkpoint(): net-of-fee price per share
                          ▼
               PerfEngine (Stylus, Rust) ── metrics(vault) ──► leaderboard / any contract
                          ▲
 AssetRegistry: stock token → Chainlink feed, pool fee │ TapeFactory: vaults, seed, genesis
```

| Path | What |
|---|---|
| `engine/` | Stylus PerfEngine (Rust). Append-only tape plus on-chain metrics |
| `contracts/src/TapeVault.sol` | Vault: deposits, in-kind redemption, oracle-bounded trading, high-water-mark fee, checkpoints |
| `contracts/src/TapeFactory.sol` | Creates vaults with a manager seed (skin in the game) and a genesis checkpoint |
| `contracts/src/AssetRegistry.sol` | Curated stock tokens. Only tokens with a Chainlink feed can be listed |
| `contracts/src/PerfEngineRef.sol` | Solidity reference engine with the same math; used in tests and the gas benchmark |
| `contracts/src/mocks/` | Testnet stand-ins with the same ABIs as mainnet: stock tokens, feeds, router, USDG |
| `scripts/relay.mjs` | Copies Robinhood Chain **mainnet** Chainlink prices into the testnet feeds |
| `scripts/smoke.sh` | End-to-end smoke test against any deployment |
| `scripts/history.mjs`, `seed.mjs` | Pull 69 trading days of mainnet Chainlink closes; replay them through 4 demo manager vaults on testnet |
| `web/` | Next.js app: landing page (`/`) and the app (`/app`: discover, vault, portfolio, manage, launch) |

## Deployments

Addresses are identical on both chains.

| Contract | Robinhood Chain testnet (46630) and Arbitrum Sepolia (421614) |
|---|---|
| PerfEngine (Stylus) | `0xEF9611533407D99e9c287480955A2923d8d6cC96` |
| TapeFactory | `0x031cBa7db6325aaA1D81533573D2A33B0fcC16Db` |
| AssetRegistry | `0x7fc05a6FE237D5690886EC95BEFdaeFD3cAaF136` |
| Router (mock) | `0xa8100b0C13D5eC28A0e38882Cfd051453AEbad6C` |
| USDG (mock, faucet) | `0x91f85A812a43A27E03d514569dF2e9b3aEa27B42` |

Stock tokens and feeds for NVDA, AAPL, TSLA, MSFT, META, AMZN, GOOGL, SPY, QQQ, PLTR and AMD are listed in `contracts/deployments/<chainId>.json`.

**Why mocks on testnet:** Robinhood Chain testnet has no Stock Tokens, no stock Chainlink feeds and no Uniswap. The stand-ins share the mainnet ABIs, and the relay feeds them live mainnet prices, so the vault code is identical on both networks.

## Proven against mainnet

`test/fork/MainnetFork.t.sol` runs the same contracts against Robinhood Chain mainnet state: real USDG, real NVDA/AAPL/TSLA Stock Tokens, real Chainlink feeds and real Uniswap v3 pools.

```
forge test --match-path 'test/fork/*' -vv
  NVDA bought: 34.59   AAPL bought: 18.06   TSLA bought: 11.20
  execution cost vs oracle: 19 bps (18,000 USDG across three pools)
  checkpoint + in-kind redemption of real stock tokens: ok
```

## Stylus vs Solidity

`scripts/bench.mjs` runs the same track records through the Stylus engine and the Solidity reference on a local Nitro devnode. Both return identical results for every size.

| Checkpoints | Solidity `metrics()` gas | Stylus `metrics()` gas | Stylus advantage |
|---|---|---|---|
| 30 | 143,489 | 128,851 | 1.11× |
| 70 | 300,482 | 219,070 | 1.37× |
| 150 | 612,126 | 402,452 | 1.52× |
| 300 | 1,196,520 | 746,235 | 1.60× |

The advantage grows with history length, because the analytics loop is compute-bound. `record()` currently costs more in Stylus (83.8k vs 51.2k gas). The Rust storage layout writes the price and the timestamp separately, while Solidity packs them into one slot. Packing them into one word is the obvious next optimisation; it waits for an engine redeploy because vaults pin the engine address.

## Tests

```
cd contracts && forge test        # 31 tests: unit, fuzz (512 runs), invariant (128 x 64 calls)
cd engine && cargo test           # 5 tests, incl. the same fixture as the Solidity reference
```

The invariants cover:
- money flows never dilute holders or move share price;
- the high-water mark never decreases;
- router allowances are always cleared after a trade.

## Run it

```
cp .env.example .env                       # PRIVATE_KEY, RPCs
cd engine && cargo stylus deploy --endpoint $RH_TESTNET_RPC --private-key $PRIVATE_KEY --no-verify
cd contracts && ENGINE=<addr> forge script script/Deploy.s.sol --rpc-url $RH_TESTNET_RPC --broadcast --slow
cd scripts && npm i && npm run relay
```

Use `https://robinhood-testnet.drpc.org` and `https://arbitrum-sepolia-rpc.publicnode.com` for Stylus activation. The official public RPCs reject it.

## Demo data

The four demo vaults (Semis Momentum, Index Steady, Mag 7 Equal Weight, Tesla Maxi) traded through the real vault contracts while real mainnet prices from Jun 23 to Sep 30, 2026 were replayed day by day. The UI labels them "Replay". Their checkpoints are real on-chain stamps, but they were compressed into one session, so on-chain timestamps are minutes apart. `scripts/data/replay-46630.json` maps each stamp to the trading day it replays. Every checkpoint after the replay is live.

```
cd web && npm i && npm run dev     # http://localhost:3000
```

## Known limits

- USDG is valued at $1. Only the ~40 stock tokens with Chainlink feeds on Robinhood Chain can be listed.
- The registry owner curates assets and feeds, a trust assumption to hand over to governance. A vault's router is fixed when the vault is created.
- A pooled vault managed for others may be a collective investment scheme. Tape is intended as infrastructure for licensed managers, and the verified track record also stands on its own.
