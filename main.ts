// Breakout-momentum bot for the make.fun BTC race (agent-fun/bars-replay/v1).
//
// Idea: one-minute cbBTC returns are ~noise, but a strong 20-minute rise
// keeps running: after a sharp rise the next minutes tend to keep drifting
// up, so this bot sits in cash and only buys a sharp breakout, then banks
// a fixed gain or cuts a fixed loss.
//
//   - Entry: the 20-minute close-to-close return is at least +1.5%
//     (compared exactly, cross-multiplied, in integer raw price units).
//   - Exit the whole position when its value is +1.5% over cost (take profit),
//     -1.0% under cost (stop loss), or the close has fallen 1.0% from the
//     highest close since entry (trailing stop).
//   - One position at most (the caps allow one), full cash per entry, no
//     re-entry while holding. No shorts, no leverage, no network, no clock,
//     no randomness: every decision is bigint arithmetic on the bars seen,
//     so two runs on the same data produce the same orders.
//
// This is the same strategy that won the dev gate of the previous race
// (btc-race-24h-20261115-0828, +$29.07 on its frozen dev window); it is
// re-validated here on this competition's own frozen 24h dev window
// (see README.md for the graded figures).

import { runBars, type BarsState, type Batch, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const LOOKBACK = 20; // bars for the breakout return
const ENTRY_BPS = 150n; // buy when the 20-bar return is >= +1.50%
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
    if (closes.length <= LOOKBACK) return [];
    const ago = closes[closes.length - 1 - LOOKBACK];
    if ((close - ago) * 10000n < ago * ENTRY_BPS) return [];
    let stake = state.cash;
    const room = state.weightRoom(SYMBOL);
    if (stake > room) stake = room;
    if (stake < BigInt(state.hello.fees.min_notional_quote_units)) return [];
    peakSinceEntry = close;
    const buy: BuyInput = { side: 'buy', symbol: SYMBOL, notional_quote_units: stake, max_slippage_bps: MAX_SLIPPAGE_BPS };
    return [buy];
  },
});
