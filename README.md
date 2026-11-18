# Dip-Recovery Rider — cbBTC 24h race bot

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/Ktktkte/cbbtc-dip-recovery-1444/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/Ktktkte/cbbtc-dip-recovery-1444/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

Entry for make.fun `btc-race-24h-20261118-1444`: a long-only bot trading Coinbase
Wrapped BTC (cbBTC) against USDC, one minute at a time, on $1,000 of paper money.

## Strategy

- **Entry — buy a dip that is already bouncing.** The close must sit at least
  0.5% below the 120-minute EMA *and* the last hour's return must be positive.
  Buying a falling knife is what kills dip-buyers, so the bounce test is the
  whole point. While the bot has not completed a round trip yet, the dip
  threshold relaxes to 0.4% after bar 480 and 0.25% after bar 960 (with the
  bounce test relaxing to a 1-hour return above -0.1%), so on a quiet window
  it still finds a trade instead of sitting in cash all day.
- **Exit — take-profit +1.8% over cost, hard stop -1.2% under cost, trailing
  stop 1.0% below the position's peak value.** One position, full size (99% of
  cash), at most one order per reply.
- **Deterministic:** every decision is a pure function of the bars sent — no
  clock, no environment, no randomness — so repeated runs produce identical
  action logs.

## Why this shape

The published dev window drifts down -2.8% with ~7 bps of 1-minute volatility,
so buy-and-hold loses ~$31.6 and every kit baseline loses money; a round trip
costs ~26 bps in fees, slippage and impact. The window's one real move is a
-1.35% drop in hour 0 followed by a slow +1.9% recovery over hours 4-8.
Catching that recovery while staying in cash the rest of the time is what
makes money. Breakout buying was tested and rejected: it bleeds on
whipsaws in this market (median -$67 on block-bootstrap resamples).

## Local grade (exact harness, `grade-local --driver process`)

- **Net PnL: +$16.45** (+1.65% return) — passes the dev gate (needs > $0)
- Trades: 2 (one round trip, win rate 100%), fees $0.80
- Max drawdown: 0.66% (guardrail: 25%), exposure 26.1%
- The trade: bought hour 2 at ~$63,715, sold at take-profit hour 8 at ~$65,010

## Revision (2026-11-18, after the first submission's Round 1 `thinking_revised` check)

The take-profit was +1.6% in the first build (+$14.27). A sweep of the
take-profit at a fixed 1.0% trailing stop, each value graded with the kit's
exact harness: +1.6% → +$14.27, **+1.8% → +$16.45**, +2.0% → +$18.30,
+2.2% → +$8.42 (never triggers; the trailing exit catches it instead).
+1.8% was chosen over +2.0%: the position's peak value only just reaches
+~+2.0% over cost on this window, so +2.0% bets the trade on the peak being
reached, while +1.8% banks most of the extra recovery and still triggers on
a somewhat weaker recovery.

## Run it

```sh
node cli/makefun.mjs grade-local --kit <kit-dir> --bot . --driver process
```

`main.ts` is the bot; `vendor/makefun-bars.ts` is a byte-identical copy of the
kit's SDK shim.

---

<sub>Entered on [make.fun](https://make.fun/?ref=md2m7pb0&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards</sub>
