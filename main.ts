// btc-race-24h-20261118-1444 — "Dip-Recovery Rider"
// Long-only cbBTC bot: buys a dip only once the market shows it is bouncing,
// then rides the recovery with a take-profit, a hard stop and a trailing stop.
//
// Why this shape (measured on the published dev window, 1,440 1-min bars):
//   - The dev window drifts down -2.8% with 1-min volatility of only ~7 bps, so
//     buy-and-hold loses ~$31.6 and every kit baseline loses money. A round trip
//     costs ~26 bps in fees, slippage and price impact, so a trade has to catch a
//     move well above that. The window's one real move is a -1.35% drop in hour 0
//     followed by a slow +1.9% recovery over hours 4-8. Catching that recovery,
//     and staying in cash the rest of the time, is what makes money here.
//   - Entry: the close is d% below the 120-minute EMA (a genuine dip, not noise)
//     AND the last hour's return is positive (the bounce has started — buying a
//     falling knife is what kills dip-buyers). d starts at 0.5% and relaxes to
//     0.4% after bar 480 and 0.25% after bar 960 while the bot has not completed
//     a round trip yet, so on a quieter window it still finds a trade (the race
//     needs at least 1 trade) instead of sitting in cash all day. After bar 960
//     the bounce test also relaxes to a 1-hour return above -0.1%.
//   - Exit: take-profit at +1.6% over cost, hard stop at -1.2% under cost,
//     trailing stop 1.0% below the position's peak value. The trailing stop is
//     what protects the gain if the recovery rolls over before the take-profit.
//   - One position, full size (99% of cash), at most one order per reply.
// The bot never reads the clock, the environment or Math.random: every decision
// is a pure function of the bars the harness sent (hello, batch, orders, bar),
// so the two graded executions produce byte-identical action logs.
import { runBars, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
/** EMA length (bars) for the dip reference. */
const EMA_BARS = 120;
/** Dip below the EMA that triggers an entry, in basis points of the EMA. */
const DIP_BPS = 50n;
/** Relaxed dip after bar 480 while no round trip has completed. */
const DIP_RELAX1_BPS = 40n;
const RELAX1_BAR = 480;
/** Further relaxed dip after bar 960 while no round trip has completed. */
const DIP_RELAX2_BPS = 25n;
const RELAX2_BAR = 960;
/** Take-profit: position worth 101.6% of its cost. */
const TP_NUM = 1016n;
const TP_DEN = 1000n;
/** Hard stop: position worth 98.8% of its cost. */
const STOP_NUM = 988n;
const STOP_DEN = 1000n;
/** Trailing stop: sell when the position is worth 99% of its peak value. */
const TRAIL_NUM = 99n;
const TRAIL_DEN = 100n;
/** Spend 99% of cash on a buy (1% stays idle). */
const BUY_NUM = 99n;
const BUY_DEN = 100n;
const MAX_SLIP_BUY = 100;
const MAX_SLIP_SELL = 100;
/** Bars of history kept to measure the last hour's return. */
const HOUR_BARS = 60;

const emaK = 2 / (EMA_BARS + 1);
let ema: number | null = null;
const closes: number[] = [];
let scored = 0;
let roundTrips = 0;
let peakValue = 0n;

await runBars({
  onBatch(state, batch) {
    if (state.warmingUp) return [];
    scored++;
    const bar = batch.bars.find((b) => b.symbol === SYMBOL);
    if (bar === undefined) return [];
    const close = Number(bar.c);

    // Incremental EMA(120) and 1-hour return, from the bars this run sent.
    ema = ema === null ? close : close * emaK + ema * (1 - emaK);
    closes.push(close);
    if (closes.length > HOUR_BARS + 1) closes.shift();
    const hourReturn = closes.length > HOUR_BARS ? close / closes[0] - 1 : null;

    const held = state.positions.get(SYMBOL);
    const orders: (BuyInput | SellInput)[] = [];

    if (held !== undefined) {
      const value = state.value(SYMBOL, held.qty);
      if (value > peakValue) peakValue = value;
      if (
        value * TP_DEN >= held.cost * TP_NUM ||
        value * STOP_DEN <= held.cost * STOP_NUM ||
        value * TRAIL_DEN <= peakValue * TRAIL_NUM
      ) {
        orders.push({ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIP_SELL });
        roundTrips++;
        peakValue = 0n;
      }
      return orders;
    }

    // Flat: enter a dip that has started bouncing.
    if (scored > EMA_BARS && ema !== null && hourReturn !== null) {
      let dipBps = DIP_BPS;
      let bounceMin = 0;
      if (roundTrips === 0 && scored > RELAX2_BAR) {
        dipBps = DIP_RELAX2_BPS;
        bounceMin = -0.001;
      } else if (roundTrips === 0 && scored > RELAX1_BAR) {
        dipBps = DIP_RELAX1_BPS;
      }
      const dipThreshold = (BigInt(Math.round(ema)) * (10000n - dipBps)) / 10000n;
      if (BigInt(bar.c) < dipThreshold && hourReturn > bounceMin) {
        let spend = (state.cash * BUY_NUM) / BUY_DEN;
        const room = state.weightRoom(SYMBOL);
        if (room < spend) spend = room;
        if (spend >= BigInt(state.hello.fees.min_notional_quote_units)) {
          orders.push({ side: 'buy', symbol: SYMBOL, notional_quote_units: spend, max_slippage_bps: MAX_SLIP_BUY });
          peakValue = 0n;
        }
      }
    }
    return orders;
  },
});
