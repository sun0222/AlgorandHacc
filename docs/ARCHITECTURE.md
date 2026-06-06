# PackRoute Agent — Architecture

## Overview

PackRoute Agent is a three-layer system:

1. **x402 Resource Server** — payment-gated APIs for procurement data
2. **Agent Orchestrator** — autonomous sourcing loop with spending guardrails
3. **Dashboard** — human configures rules and monitors agent activity

## Payment flow (x402)

```
Agent Orchestrator
    │  wrapFetchWithPayment (402 → pay → retry)
    ▼
Express API (/api/v1/*)
    │  paymentMiddleware verifies via facilitator
    ▼
GoPlausible Facilitator
    │  verify + settle on Algorand TestNet
    ▼
Algorand (USDC ASA transfer)
```

## Agent sourcing loop

```
1. POST /agent/jobs { rules }
2. Agent pays x402 → GET /packaging-prices
3. Filter suppliers (price, MOQ, food-grade)
4. Agent pays x402 → GET /freight-quote (top 2)
5. Compute landed cost = unit×qty + freight
6. Agent pays x402 → POST /checkout (winner)
7. Job completed with order_id + tx log
```

## Spending rules

Configured via environment variables:

- `MAX_DAILY_SPEND_USD` — daily agent cap
- `MAX_SINGLE_TX_USD` — per-transaction limit
- `MAX_API_SPEND_USD` — API-only sub-limit

## Demo vs Live mode

| Mode | Trigger | Behavior |
|---|---|---|
| Demo | `DEMO_MODE=true` or missing keys | Simulated x402 with demo tx IDs |
| Live | `AGENT_AVM_PRIVATE_KEY` + `RESOURCE_PAY_TO` | Real TestNet USDC via GoPlausible |

## Milestone roadmap (post-hackathon)

1. Mainnet deploy + Quantoz EURQ settlement
2. Real freight API integration (DE-NL corridor)
3. On-chain agent wallet smart contract (AlgoKit)
