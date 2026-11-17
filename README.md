# BTC Race 24h — Breakout Momentum Bot

Entry for [make.fun](https://make.fun) competition
`btc-race-24h-20261117-0603` — race a BTC trading bot live for 24 hours.

## Strategy

A long-only, cash-first regime-switching bot trading cbBTC/USDC on
1-minute bars from the Orca Whirlpool, starting with $1,000 of paper
money. The 4-hour trend decides which entry is armed:

- **Flat/up regime** (240-minute return ≥ −0.5%): **buy the dip** — the
  45-minute return is ≤ −1.0% **and** the last 5 minutes already bounce
  (≥ +0.2%). A dip still falling is not bought.
- **Down regime** (240-minute return < −0.5%): **buy the breakout** —
  the 20-minute return is ≥ +1.5%. Dip-buying into a falling market is
  switched off.
- **Exit (whole position):** take profit at **+1.5%** over cost, stop loss
  at **−1.0%** under cost, or trailing stop **−1.0%** from the highest
  close since entry.
- **Why:** on 1-minute bars, returns are ~noise, but a 45-minute dip that
  already bounces keeps recovering in a flat market, while in a downtrend
  only a sharp breakout is worth chasing. The bot only pays the ~26 bps
  round-trip cost when a real move is already under way, and it never
  catches a falling knife.

Same strategy as the previous race (`btc-race-24h-20261115-0828`), which
passed its dev gate at +$29.07 — but re-shaped for this window: the plain
breakout bot loses −$12.24 here, and plain dip-buying wins +$28.00 here
but loses −$88.21 on the previous race's window. The regime switch below
is positive on both windows.

## Results on the frozen dev window

(graded with the kit's own grader, `makefun grade-local --driver process`;
two graded executions produce identical action logs)

| Bot | Net PnL | Trades | Max DD |
| --- | --- | --- | --- |
| **This bot** | **+$13.90** | 2 | 0.62% |
| momentum | +$2.45 | 1 | 2.12% |
| buy-and-hold | +$1.07 | 1 | 2.12% |
| hold-cash | $0.00 | 0 | 0.00% |
| rsi-bollinger | −$24.25 | 11 | 2.79% |
| adx-momentum | −$32.66 | 26 | 3.60% |
| ema-cross | −$106.21 | 68 | 10.96% |

Dev window: BTC +0.5% over the day; the bot caught two dip-bounce legs
in the flat/up regime (2 round trips, win rate 100%, fees $0.81).
Out-of-sample check on the previous race's frozen window (BTC −4.0%):
**+$14.96**, 2 trades, max drawdown 0.33% — the regime switch keeps it
positive where plain dip-buying loses −$88.21. Verified with the kit's
own grader (`makefun grade-local --driver process`); the two graded
executions produce identical action logs.

## Implementation

- `main.ts` — the bot (Node 22, standard library only). All decisions
  are integer arithmetic on the bars seen: no network, no wall clock, no
  randomness, no files outside the repo — two runs on the same data give
  byte-identical orders.
- `vendor/makefun-bars.ts` — byte-identical copy of the kit's TypeScript shim
  (`sdk/makefun-bars.ts`), as the kit instructs.

## License

MIT — see `LICENSE`.
