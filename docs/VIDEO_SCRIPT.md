# PackRoute Agent — Video Recording Script (3 min)

## Pre-recording checklist

- [ ] `npm run dev` running (API + dashboard)
- [ ] Browser: http://localhost:3000 at 100% zoom
- [ ] Terminal visible (optional) showing API logs
- [ ] Lora explorer tab ready: https://lora.algokit.io/
- [ ] Close notifications / dark mode consistent

---

## SCENE 1 — Hook (0:00–0:25)

**[Screen: Dashboard]**

> "European food SMEs spend 18 hours per sourcing run — emailing suppliers, comparing freight, paying manually.
>
> This is **PackRoute Agent** — an autonomous procurement agent for F&B packaging. It pays cents via **x402 on Algorand** for each API call, compares cross-border options, and settles checkout. No procurement SaaS subscription."

**[Point to badge: Demo x402 or Live TestNet x402]**

---

## SCENE 2 — Problem + form (0:25–0:50)

**[Scroll to job form]**

> "Meet an Amsterdam jam producer. She needs 500 glass jars from Germany, max 85 cents per unit, delivered to the Netherlands."

**[Show fields: 500 units, €0.85, DE-NL corridor, delivery date]**

> "She sets the rules once. The agent does the rest."

---

## SCENE 3 — Live demo (0:50–2:10)

**[Click "Run PackRoute Agent"]**

> "Watch the agent work autonomously — I don't click pay at each step."

**[As steps complete, narrate each:]**

1. **Fetch packaging prices** — "Pays one cent for the EU packaging price index via x402"
2. **Freight quotes** — "Pays five cents each for DE to NL freight quotes"
3. **Compare landed cost** — "Picks NordPack — lowest total including freight"
4. **Settle with supplier** — "Pays ten cents to confirm checkout on Algorand"

**[Show result card with order ID and € total]**

**[Scroll to x402 payment log]**

> "Every micropayment is logged on-chain. Four transactions, full audit trail."

**[If live TestNet: click Lora tx link]**

> "Here's the actual USDC transfer on Algorand TestNet — settled in under 4 seconds."

---

## SCENE 4 — Tech stack (2:10–2:40)

**[Optional: briefly show GitHub or architecture doc]**

> "Built with the x402 starter pattern: Express middleware from GoPlausible facilitator, agent wallet with spending caps, and a deterministic sourcing loop.
>
> For the Quantoz bonus track, we support EURQ settlement — programmable euro micropayments for cross-border B2B."

---

## SCENE 5 — Close (2:40–3:00)

**[Back to dashboard result]**

> "PackRoute Agent — autonomous packaging procurement for European SMEs.
>
> Post-hackathon milestone: mainnet deploy, EURQ via Quantoz, and a real freight API on the DE-NL corridor.
>
> Thank you."

**[End screen: GitHub repo URL + team name]**

---

## B-roll shots (optional 15 sec each)

- `.env` with `DEMO_MODE=false`
- Terminal: `npm run setup:testnet` output
- Lora explorer showing 4 transactions
- `docs/ARCHITECTURE.md` diagram

---

## One-liner for submission form

> PackRoute Agent: autonomous EU F&B packaging procurement — AI agent pays per API call via x402 on Algorand (USDC/EURQ), compares cross-border suppliers, and settles checkout within spending rules.
