# Tape: returns you can't fake

**One-liner:** Copy trading for tokenized stocks, where every return is proven on-chain. Settled in USDG on Robinhood Chain, scored by a Rust engine on Arbitrum Stylus.

**Live app:** https://tape-verified.vercel.app. Click *Connect → Demo wallet* for instant gas and 10,000 test USDG; no wallet setup is needed.

**Networks:** Robinhood Chain testnet (46630) and Arbitrum Sepolia (421614), at identical contract addresses.

---

## Problem

Retail investors in Asia follow "finfluencers" whose returns can't be checked.

- **India:** SEBI bars unregistered finfluencers from making return claims, and launched PaRRVA, an agency whose job is to verify past performance.
- **Singapore:** MAS's digital-advertising rules now reach the content creators who promote financial products.
- **Robinhood:** Robinhood launched verified, copyable trades (Robinhood Social) in 2026, but only inside its US app. Robinhood Stock Tokens reach 120+ countries where that app doesn't.

The demand for verified returns is real, and it isn't met where stock tokens are actually sold.

## Solution

Tape makes the chain the verification agency.

- **Public portfolio vaults.** A manager runs a portfolio of Robinhood Stock Tokens and USDG. Every trade goes through the vault, so nothing can be hidden, backdated or cherry-picked.
- **The tape (Rust on Stylus).** Each checkpoint appends the vault's net-of-fee share price to an append-only record keyed to the vault. Total return, max drawdown, volatility and Sharpe are computed on-chain, so any contract can gate on them, for example a fund-of-funds that only allocates to verified Sharpe > 1.
- **Copy in one click.** Followers deposit USDG and get shares at oracle NAV. They can exit at any time, pro-rata and in kind.

## Why followers can trust a stranger's vault

| Guarantee | Enforcement |
|---|---|
| Manager can't take the money | `trade()` is the only manager action: USDG ↔ the vault's fixed list of stock tokens, through the registry router |
| Manager can't trade at a bad price | Fills are measured by balance diff and must land within `maxDevBps` of Chainlink (hard cap 150 bps) |
| Followers can always leave | In-kind redemption reads no oracle: it works on weekends, during outages, and with an absent manager |
| Track record can't be padded | Deposits and redemptions never move share price (invariant-tested); entry fees go to a treasury, never into the vault |
| Fees only on new highs | Performance fee is minted as shares, only above the high-water mark |
| Stale prices can't price you in | Deposits halt when a held asset's 24/5 feed goes stale |

## Built with Arbitrum

- **Stylus.** The track-record engine (`engine/`, Rust, 13.4 KB) stores the append-only tape and computes the metrics on-chain. It is benchmarked against a bit-identical Solidity reference: `metrics()` is 1.11× cheaper at 30 checkpoints and 1.60× at 300, and the gap grows with history. `record()` currently costs more in Stylus because of an unpacked storage layout, which is documented with the fix.
- **Robinhood Chain.** The app is built for Robinhood Stock Tokens. It uses Chainlink feeds that already include the ERC-8056 multiplier, so prices are per token. The vaults hold USDG as the cash leg.
- **Arbitrum Sepolia.** The same contracts are deployed at the same addresses.

## Proven against mainnet

The testnet contracts also run in a Foundry suite against **Robinhood Chain mainnet state**: real USDG, real NVDA/AAPL/TSLA tokens, real Chainlink feeds and real Uniswap v3 pools. The vault bought $18k of three stocks through real liquidity at **19 bps total cost vs the oracle**, stamped a checkpoint and redeemed in kind.

## Quality

- 32 Foundry tests: unit tests, fuzz tests (512 runs), invariant tests (128 runs × 64 calls), and a mainnet fork suite.
- 5 Rust tests. The Solidity and Rust engines share fixtures and must agree to the wei.
- A security bug was found and fixed during testing. Entry fees kept in the vault raised share price, which let a manager pad their track record by churning deposits. Fees now go to a treasury, and an invariant enforces that money flows can't move share price.

## Demo data

Four manager vaults, each with a different strategy (Semis Momentum, Index Steady, Mag 7 Equal Weight, Tesla Maxi), traded through the real contracts while **69 trading days of real mainnet Chainlink prices (Jun 23 – Sep 30, 2026)** were replayed. Followers deposited and one redeemed part of their position. These vaults are labelled *Replay* in the UI. Every checkpoint after the replay is live, and testnet prices are mirrored from mainnet by a serverless relay.

## USDG

USDG is the deposit asset, the quote asset for every trade, the cash leg of every portfolio, and the unit of every fee.

## Path to mainnet and KPIs

1. Deploy the same contracts on Robinhood Chain mainnet. The real USDG, stock tokens, Chainlink feeds and Uniswap router are already wired in the fork suite.
2. Onboard licensed managers first: Singapore RFMCs and SEBI-registered advisers who need verifiable track records.
3. Proposed KPIs: verified vaults launched, value copied (TVL), and the number of checkpoints stamped.

## Links

- App: https://tape-verified.vercel.app
- Stylus engine: `0xEF9611533407D99e9c287480955A2923d8d6cC96` (both chains)
- TapeFactory: `0x031cBa7db6325aaA1D81533573D2A33B0fcC16Db` (both chains)
- Explorer (Robinhood testnet): https://explorer.testnet.chain.robinhood.com/address/0x031cBa7db6325aaA1D81533573D2A33B0fcC16Db
