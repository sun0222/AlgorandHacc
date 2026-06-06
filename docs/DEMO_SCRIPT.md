# PackRoute Agent — 3-Minute Demo Script

## Setup (before judges)

1. Open http://localhost:3000
2. Confirm badge shows **Demo x402** or **Live TestNet x402**
3. Have Lora explorer ready: https://lora.algokit.io/

## Pitch (30 seconds)

> "European food SMEs spend 18 hours per sourcing run — emailing suppliers, comparing freight, paying manually. PackRoute Agent is an autonomous procurement agent for F&B packaging. It pays cents via x402 on Algorand for each API call, compares cross-border options, and settles checkout — no procurement SaaS subscription."

## Live demo (90 seconds)

1. **Show the form** — "500 glass jars, max €0.85/unit, Germany to Netherlands"
2. **Click Run PackRoute Agent**
3. **Walk through steps** as they animate:
   - Fetch packaging prices ($0.01 x402)
   - Get freight quotes ($0.05 x402)
   - Compare landed cost
   - Settle with supplier ($0.10 x402)
4. **Show result** — supplier name, total €, order ID
5. **Show payment log** — click Lora link if live TestNet

## Technical highlight (30 seconds)

> "Every API call returns HTTP 402 until the agent wallet pays USDC on Algorand. GoPlausible facilitator verifies and settles in ~3 seconds. The agent has spending rules — daily cap, per-transaction limit — so it can't overspend."

## Close (30 seconds)

> "This is PackRoute for EU F&B packaging. Post-hackathon milestone: mainnet, EURQ via Quantoz, and one real freight API partner on the DE-NL corridor."

## FAQ prep

**Q: Why not just use SAP?**  
A: SAP is for enterprises. 99% of EU businesses are SMEs with ~12 sourcing runs per year — pay-per-use beats €200/month SaaS.

**Q: Is the supplier data real?**  
A: Mock for hackathon; architecture supports real APIs behind x402 paywalls.

**Q: Why Algorand?**  
A: Sub-second finality fits x402's synchronous HTTP flow; low fees make $0.01 micropayments viable.
