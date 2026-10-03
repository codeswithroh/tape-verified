# Brag Plan: Tape

## What is this app?
Copy trading for tokenized stocks on Robinhood Chain: managers run public vaults, every return is stamped on-chain by a Rust engine on Arbitrum Stylus, and followers copy with USDG and can exit in kind at any time.

## The angle
"Returns you can't fake." Stock tips are sold on screenshots, and regulators are building agencies just to check them. Tape makes the chain the verification agency. The video moves from a fake +312% post stamped UNVERIFIED to a real, append-only track record, then shows a real copy and exit on the live app.

## Hook (first 2-3 seconds)
An influencer post claiming "+312% this quarter 🚀" slides in on cream paper, and a red UNVERIFIED stamp slams onto it.

## Key moments (the middle)
- The Discover leaderboard: 4 verified vaults, risk/return map, live stats.
- The Mag 7 vault: equity curve with one tick per on-chain checkpoint, the printed "Tape" receipt, and metric tiles computed by Stylus.
- The live flow: copy $1,000 in one click → stake $998.00 → exit 50% in kind (a slice of every stock).

## Outro / punchline
"Stop trusting screenshots." → Tape mark, "Returns you can't fake.", tape-verified.vercel.app, built on Robinhood Chain · Arbitrum Stylus · USDG.

## User flow worth showing
Discover a verified vault → inspect its on-chain tape → Demo wallet → Copy 1k → stake appears → Exit in kind.

## Tone
- Preset: polished (with app-store feature-card clarity)
- Creative direction: editorial fintech film: paper and ink, one orange signal colour
- Interpretation: confident, restrained motion, long readable holds, soft slides and crossfades, real UI as the hero.

## Format: landscape — 1920x1080
## Duration: ~65s (deliberate departure from the 15-25s default: this is the hackathon demo submission, so it must show the working flow)

## Visual identity (from the project)
- Paper background: #f1ece1; ink: #0e0e0c; app dark: #0e0e0c / #151513 / lines #2a2925
- Accent (signal): #ff6a2b; gain #3fd68a; loss #ff5d5d; cream text #ece6d8
- Display font: Instrument Serif (incl. italic); body: Instrument Sans; numbers: JetBrains Mono
- Strongest visual element: the orange tape strip under "fake.", the perforated receipt, the rotating verified seal, the dark equity curve

## Share copy (draft)
Tape: copy trading for tokenized stocks where every return is stamped on-chain. Rust on Arbitrum Stylus, USDG on Robinhood Chain.

## Audio direction
- Role: warm, steady bed with sparse professional accents
- Music: happy-beats-business-moves-vol-12 (polished, 110 BPM), 0.30 volume, fade out under the outro
- Music cue guidance: preset `happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json`; strong cue 17.47s → Discover reveal; beat period ≈0.545s for sequential reveals (every other beat for text)
- Audio-reactive treatment: subtle; music RMS gently lifts the glow behind the product frames. No visualizers.
- SFX posture: sparse. Stamp hit on UNVERIFIED, soft drops for card reveals, a click for Copy, a bell on the outro mark.
- Restraint rule: no SFX on every text line; nothing louder than the stamp.

## Storyboard
1. Hook — 0–5.5s — paper; fake post slides in; UNVERIFIED stamp slams (impact). Line: "Stock tips are sold on screenshots."
2. Problem — 5.5–12s — three facts arrive one by one and hold: India built an agency to verify returns · Singapore regulates finfluencers · Robinhood verifies trades, US app only.
3. Reveal — 12–17.5s — Tape mark + "Returns you can't fake." (orange tape strip sweeps under "fake.") → landing hero screenshot.
4. Discover — 17.5–25s — dark; leaderboard screenshot in a frame, slow push-in; callouts "4 verified vaults" / "69 days of real mainnet prices, replayed".
5. The tape — 25–34s — vault page: zoom to the equity curve ("every tick = an on-chain checkpoint"), then pan to the receipt ("append-only") and metric tiles ("computed on-chain · Rust on Arbitrum Stylus").
6. Copy — 34–41.5s — Copy panel with 1000 USDG; simulated click (click SFX); stake card $998.00 · 7.39% appears. Line: "Demo wallet. 10,000 USDG. One click."
7. Exit — 41.5–47.5s — Exit panel: 50%, you receive in kind; line: "Leave anytime. In kind. No oracle. No manager."
8. Guarantees — 47.5–54s — three cards one by one: Manager can't withdraw · Fills within 150 bps of Chainlink · Deposits can't pad the record.
9. Proof — 54–59.5s — "Same code. Real market." 19 bps on real Uniswap · 1.6× cheaper metrics on Stylus · 32 tests.
10. Outro — 59.5–65s — orange: "Stop trusting screenshots." → Tape mark, URL, stack line, seal.
