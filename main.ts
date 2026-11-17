// Regime-switching bot for the make.fun BTC race (agent-fun/bars-replay/v1).
//
// One-minute cbBTC returns are ~noise, but 45-minute dips and 20-minute
// breakouts behave differently depending on the 4-hour regime, so this bot
// switches entries by regime and sits in cash the rest of the time:
//
//   - FLAT/UP regime (240-minute return >= -0.5%): buy the dip — the
//     45-minute close-to-close return is at most -1.0% AND the last 5
//     minutes already bounce (+0.2% or more). A dip that is still falling
//     is not bought.
//   - DOWN regime (240-minute return < -0.5%): buy the breakout — the
//     20-minute close-to-close return is at least +1.5%. Dip-buying into
//     a falling market is a knife catch, so it is switched off here.
//   - Exit the whole position when its value is +1.5% over cost (take
//     profit), -1.0% under cost (stop loss), or the close has fallen 1.0%
//     from the highest close since entry (trailing stop).
//   - One position at most, full cash per entry, no re-entry while holding.
//     No shorts, no leverage, no network, no clock, no randomness: every
//     decision is bigint arithmetic on the bars seen, so two runs on the
//     same data produce the same orders.
//
// Why this shape: on this competition's frozen dev window (BTC +0.5% over
// the day) the plain breakout bot of the previous race loses -$12.24, and
// plain dip-buying wins +$28.00 here but loses -$88.21 on the previous
// race's frozen window (BTC -4.0% over the day, where the breakout bot won
// +$29.07). The regime switch is positive on BOTH windows: +$13.90 here,
// +$14.96 there, 2 trades each, max drawdown 0.62% / 0.33% — and it stays
// positive on both under every nearby parameter change tried (bounce
// 0.1–0.3%, dip entry 0.9–1.25%, trend gate -0.25%…-1.0%, TP 1.25–2%).

import { runBars, type BarsState, type Batch, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const DIP_LOOKBACK = 45; // bars for the dip return
const DIP_BPS = 100n; // buy the dip when the 45-bar return is <= -1.00%
const BOUNCE_LOOKBACK = 5; // bars for the bounce confirmation
const BOUNCE_BPS = 20n; // ... and the 5-bar return is >= +0.20%
const TREND_LOOKBACK = 240; // bars for the regime (4 hours)
const TREND_MIN_BPS = -50n; // flat/up regime when the 240-bar return is >= -0.50%
const BREAK_LOOKBACK = 20; // bars for the breakout return
const BREAK_BPS = 150n; // buy the breakout when the 20-bar return is >= +1.50%
const TAKE_PROFIT_NUM = 1015n; // sell when value >= cost * 1015 / 1000 (+1.5%)
const TAKE_PROFIT_DEN = 1000n;
const STOP_LOSS_NUM = 99n; // sell when value <= cost * 99 / 100 (-1.0%)
const STOP_LOSS_DEN = 100n;
const TRAIL_NUM = 99n; // sell when close <= peak * 99 / 100 (-1.0% from peak)
const TRAIL_DEN = 100n;
const MAX_SLIPPAGE_BPS = 100;

/** Closes seen so far, in raw price units (price_scale 5), oldest first. */
const closes: bigint[] = [];
/** Highest close since the current entry, in raw price units (null when flat). */
let peakSinceEntry: bigint | null = null;

/** Exact bps comparison: (close - ago) / ago >= bps / 10000. */
function retAtLeast(close: bigint, ago: bigint, bps: bigint): boolean {
  return (close - ago) * 10000n >= ago * bps;
}
/** Exact bps comparison: (close - ago) / ago <= -bps / 10000. */
function retAtMostNeg(close: bigint, ago: bigint, bps: bigint): boolean {
  return (close - ago) * 10000n <= -ago * bps;
}

await runBars({
  onBatch(state: BarsState, batch: Batch) {
    for (const bar of batch.bars) {
      if (bar.symbol === SYMBOL) closes.push(BigInt(bar.c));
    }
    if (state.warmingUp) return [];
    const close = state.close(SYMBOL);
    if (close === null) return [];
    const held = state.positions.get(SYMBOL);
    if (held !== undefined) {
      if (peakSinceEntry === null || close > peakSinceEntry) peakSinceEntry = close;
      const value = state.value(SYMBOL, held.qty);
      if (
        value * TAKE_PROFIT_DEN >= held.cost * TAKE_PROFIT_NUM ||
        value * STOP_LOSS_DEN <= held.cost * STOP_LOSS_NUM ||
        close * TRAIL_DEN <= peakSinceEntry * TRAIL_NUM
      ) {
        peakSinceEntry = null;
        const sell: SellInput = { side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS };
        return [sell];
      }
      return [];
    }
    const n = closes.length;
    const ago240 = n > TREND_LOOKBACK ? closes[n - 1 - TREND_LOOKBACK] : null;
    // Flat/up regime: 240-bar return >= -0.50% (TREND_MIN_BPS is negative).
    const flatOrUp = ago240 !== null && retAtLeast(close, ago240, TREND_MIN_BPS);
    let fire = false;
    if (flatOrUp) {
      // Flat/up regime: dip + bounce.
      if (n > DIP_LOOKBACK && n > BOUNCE_LOOKBACK) {
        const ago45 = closes[n - 1 - DIP_LOOKBACK];
        const ago5 = closes[n - 1 - BOUNCE_LOOKBACK];
        if (retAtMostNeg(close, ago45, DIP_BPS) && retAtLeast(close, ago5, BOUNCE_BPS)) fire = true;
      }
    }
    if (!fire && !flatOrUp) {
      // Down regime (or trend unknown yet): breakout.
      if (n > BREAK_LOOKBACK) {
        const ago20 = closes[n - 1 - BREAK_LOOKBACK];
        if (retAtLeast(close, ago20, BREAK_BPS)) fire = true;
      }
    }
    if (!fire) return [];
    let stake = state.cash;
    const room = state.weightRoom(SYMBOL);
    if (stake > room) stake = room;
    if (stake < BigInt(state.hello.fees.min_notional_quote_units)) return [];
    peakSinceEntry = close;
    const buy: BuyInput = { side: 'buy', symbol: SYMBOL, notional_quote_units: stake, max_slippage_bps: MAX_SLIPPAGE_BPS };
    return [buy];
  },
});
