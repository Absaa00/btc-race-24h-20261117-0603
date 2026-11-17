# BTC Race 24h — Breakout Momentum Bot

Entry for [make.fun](https://make.fun) competition
`btc-race-24h-20261117-0603` — race a BTC trading bot live for 24 hours.

## Strategy

A long-only, cash-first breakout bot trading cbBTC/USDC on 1-minute bars
from the Orca Whirlpool, starting with $1,000 of paper money.

- **Entry:** buy with full cash when the 20-minute close-to-close return
  reaches **+1.5%** (a sharp breakout). Otherwise sit in cash.
- **Exit (whole position):** take profit at **+1.5%** over cost, stop loss at
  **−1.0%** under cost, or trailing stop **−1.0%** from the highest close
  since entry.
- **Why:** on 1-minute bars, returns are ~noise, but a strong 20-minute
  rise keeps running. The bot only pays the ~26 bps round-trip cost when
  a real move is already under way.

Same strategy as the previous race (`btc-race-24h-20261115-0828`), which
passed its dev gate at +$29.07; re-validated here on this competition's
own frozen dev window.

## Results on the frozen dev window

(graded with the kit's own grader, `makefun grade-local --driver process`;
two graded executions produce identical action logs)

| Bot | Net PnL | Trades | Max DD |
| --- | --- | --- | --- |
| **This bot** | TBD | TBD | TBD |

## Implementation

- `main.ts` — the bot (Node 22, standard library only). All decisions
  are integer arithmetic on the bars seen: no network, no wall clock, no
  randomness, no files outside the repo — two runs on the same data give
  byte-identical orders.
- `vendor/makefun-bars.ts` — byte-identical copy of the kit's TypeScript shim
  (`sdk/makefun-bars.ts`), as the kit instructs.

## License

MIT — see `LICENSE`.
