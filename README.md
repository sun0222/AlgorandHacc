# PackRoute Agent

Autonomous **EU F&B packaging procurement agent** for the [Algorand x402 Agentic Commerce Hackathon](https://luma.com/agentic-commerce-hack).

An AI agent sources cross-border packaging suppliers, pays for intelligence via **x402 micropayments** on Algorand, and completes supplier checkout — all within owner-defined spending rules.

## Demo scenario

> Amsterdam organic jam producer needs **500 glass jars**, max **€0.85/unit**, shipped from **Germany → Netherlands** by June 20.

The agent autonomously:
1. Pays **$0.01** USDC (x402) for packaging supplier price index
2. Pays **$0.05** USDC (x402) for cross-border freight quotes
3. Compares landed cost and selects best supplier
4. Pays **$0.10** USDC (x402) to confirm supplier checkout

## Live TestNet x402 (for hackathon submission)

```bash
npm run setup:testnet    # generate wallet + check balances
# Copy output into .env, fund ALGO + USDC, set DEMO_MODE=false
npm run dev
```

Full guide: [docs/TESTNET_SETUP.md](docs/TESTNET_SETUP.md)

## Quantoz EURQ bonus track

```env
PAYMENT_ASSET=EURQ
QUANTOZ_API_KEY=your_key
QUANTOZ_ACCOUNT=your_account
RESOURCE_PAY_TO=whitelisted_algorand_address
DEMO_MODE=false
```

Agent uses `@ever_amsterdam/x402-euro-eurd` for programmable euro payments.

## Demo video

Recording script: [docs/VIDEO_SCRIPT.md](docs/VIDEO_SCRIPT.md)

## Quick start (demo mode)

### 1. Install dependencies

```bash
cd /Users/sunil/Desktop/Algorand
npm install
npm run build -w @packroute/mocks
```

### 2. Configure environment

```bash
cp .env.example .env
```

**Demo mode (no TestNet wallet needed):**

```bash
DEMO_MODE=true
```

**Live TestNet x402:**

```bash
npm run generate-wallet -w @packroute/api
# Copy output into .env as AGENT_AVM_PRIVATE_KEY and RESOURCE_PAY_TO
# Fund address with TestNet ALGO + USDC
DEMO_MODE=false
```

### 3. Run

```bash
npm run dev
```

- **Dashboard:** http://localhost:3000
- **API:** http://localhost:4021
- **Agent API:** http://localhost:4021/agent

## Project structure

```
packroute-agent/
├── apps/
│   ├── api/          # Express + x402 payment-gated APIs + agent orchestrator
│   └── web/          # Next.js dashboard
├── packages/
│   └── mocks/        # EU packaging suppliers + freight mock data
└── docs/
    ├── ARCHITECTURE.md
    └── DEMO_SCRIPT.md
```

## x402 endpoints

| Endpoint | Price | Description |
|---|---|---|
| `GET /api/v1/packaging-prices` | $0.01 USDC | EU F&B packaging supplier index |
| `GET /api/v1/freight-quote` | $0.05 USDC | Cross-border freight quotes |
| `POST /api/v1/checkout` | $0.10 USDC | Supplier order settlement |

## Agent API

| Method | Path | Description |
|---|---|---|
| `POST` | `/agent/jobs` | Start procurement job |
| `GET` | `/agent/jobs/:id` | Poll job status |
| `GET` | `/agent/wallet` | Agent spending limits + usage |

## Hackathon alignment

- **Mandatory:** x402 on Algorand ✅
- **Track:** Agentic Commerce ✅
- **Bonus:** Quantoz EURQ (swap USDC asset in `apps/api/src/index.ts`) ✅


## Demo Link
- https://claude.ai/design/p/b35371b6-2874-40cb-92fc-0b93979a24fe?file=PackRoute%20Demo.html&present=1
## PPT Link
- https://claude.ai/design/p/104b5fd6-c59e-4c21-9867-65dbf2e48b9c?file=PackRoute%20Agent%20Pitch.html&present=1

## TestNet funding

- **ALGO:** [Lora TestNet faucet](https://lora.algokit.io/)
- **USDC:** [Circle faucet](https://faucet.circle.com/) (Algorand TestNet)
- **Facilitator:** [GoPlausible](https://facilitator.goplausible.xyz/)

## License

MIT — built for AlgoBharat / Algorand x402 Agentic Commerce Hackathon
