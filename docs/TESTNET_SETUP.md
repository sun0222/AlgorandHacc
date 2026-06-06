# TestNet & Live x402 Setup

## Quick setup (5 minutes)

```bash
cd /Users/sunil/Desktop/Algorand
npm install
npm run setup:testnet
```

This script will:
1. Generate a wallet if none exists
2. Print `.env` values to copy
3. Check ALGO + USDC balances on TestNet

Then:

```bash
# Edit .env
DEMO_MODE=false

# Start
npm run dev
```

Open http://localhost:3000 — badge should show **Live TestNet x402**.

---

## Fund your wallet

| Asset | Faucet | Amount needed |
|---|---|---|
| **ALGO** | [Lora TestNet faucet](https://lora.algokit.io/) | ≥ 0.5 ALGO (tx fees) |
| **USDC** | [Circle faucet](https://faucet.circle.com/) → Algorand TestNet | ≥ 0.25 USDC (~$0.21 per agent run) |

Each agent run makes **4 x402 payments**:
- €0.01 packaging index
- €0.05 freight × 2 suppliers
- €0.10 checkout

---

## Payment paths

### Path A — TestNet USDC (recommended for hackathon demo)

```env
PAYMENT_ASSET=USDC
DEMO_MODE=false
AGENT_AVM_PRIVATE_KEY=<base64 from setup:testnet>
RESOURCE_PAY_TO=<address from setup:testnet>
FACILITATOR_URL=https://facilitator.goplausible.xyz
```

Agent pays via `@x402-avm/fetch` + Algorand wallet.

### Path B — Quantoz EURQ bonus track

```env
PAYMENT_ASSET=EURQ
DEMO_MODE=false
RESOURCE_PAY_TO=<your whitelisted Algorand address>
QUANTOZ_API_KEY=<from Quantoz hackathon>
QUANTOZ_ACCOUNT=<your Quantoz account code>
FACILITATOR_URL=https://x402algo.ai.quantozpay.com
```

Agent pays via `@ever_amsterdam/x402-euro-eurd` (`withEurPayment`).

**Important:** EURQ/EURD require **Quantoz KYC whitelist** for sender and receiver addresses. Contact Quantoz at the hackathon.

| Asset | ASA ID | Network |
|---|---|---|
| EURD | 1221682136 | Algorand Mainnet |
| EURQ | 2768422954 | Algorand Mainnet |

---

## Verify live payments

1. Run agent from dashboard
2. Click **View tx →** links in payment log
3. Or search agent address on [Lora](https://lora.algokit.io/)

---

## Troubleshooting

| Error | Fix |
|---|---|
| `402 Payment Required` loop | Fund USDC; ensure opted in to ASA 10458941 |
| `insufficient balance` | Circle faucet → more USDC |
| `x402 middleware disabled` | Set `DEMO_MODE=false` + `RESOURCE_PAY_TO` |
| Quantoz payment fails | Confirm whitelist + `QUANTOZ_API_KEY` |
