import algosdk from "algosdk";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const envPath = path.join(rootDir, ".env");
dotenv.config({ path: envPath });

const USDC_TESTNET_ASA = 10458941;
const ALGOD = process.env.ALGOD_URL ?? "https://testnet-api.algonode.cloud";
const ALGOD_TOKEN = process.env.ALGOD_TOKEN ?? "";

async function main() {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║   PackRoute Agent — TestNet Setup        ║");
  console.log("╚══════════════════════════════════════════╝\n");

  const client = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD, "");

  let address = process.env.RESOURCE_PAY_TO;
  let privateKeyB64 = process.env.AGENT_AVM_PRIVATE_KEY;

  if (!address || !privateKeyB64) {
    console.log("No wallet in .env — generating new TestNet wallet...\n");
    const account = algosdk.generateAccount();
    address = account.addr.toString();
    privateKeyB64 = Buffer.from(account.sk).toString("base64");
    console.log("Address:", address);
    console.log("\nAdd these lines to your .env:\n");
    console.log(`AGENT_AVM_PRIVATE_KEY=${privateKeyB64}`);
    console.log(`RESOURCE_PAY_TO=${address}`);
    console.log("DEMO_MODE=false\n");
  } else {
    console.log("Using existing wallet:", address);
  }

  // Balance checks
  try {
    const accountInfo = await client.accountInformation(address!).do();
    const algoBalance = Number(accountInfo.amount) / 1_000_000;
    console.log(`\n✓ ALGO balance: ${algoBalance.toFixed(4)} ALGO`);

    if (algoBalance < 0.5) {
      console.log("\n⚠ Low ALGO — fund via TestNet faucet:");
      console.log("  https://lora.algokit.io/");
      console.log(`  Address: ${address}`);
    }

    const usdcHolding = accountInfo.assets?.find(
      (a: { assetId: bigint | number }) => Number(a.assetId) === USDC_TESTNET_ASA,
    );

    if (!usdcHolding) {
      console.log("\n⚠ Not opted in to TestNet USDC (ASA 10458941)");
      console.log("  Opt-in via Lora wallet or run with funded Pera wallet.");
      console.log("  USDC faucet: https://faucet.circle.com/ (select Algorand TestNet)");
    } else {
      const usdc = Number(usdcHolding.amount) / 1_000_000;
      console.log(`✓ USDC balance: ${usdc.toFixed(4)} USDC`);
      if (usdc < 0.5) {
        console.log("\n⚠ Low USDC — each agent run uses ~$0.21 USDC (3 x402 calls)");
        console.log("  Fund: https://faucet.circle.com/");
      } else {
        console.log("\n✓ Wallet ready for live x402 agent runs!");
      }
    }
  } catch (err) {
    console.log("\n⚠ Could not reach Algorand TestNet:", (err as Error).message);
    console.log("  Check ALGOD_URL or try again later.");
  }

  console.log("\n── Next steps ──");
  console.log("1. Set DEMO_MODE=false in .env");
  console.log("2. npm run dev");
  console.log("3. Open http://localhost:3000 → Run PackRoute Agent");
  console.log("\n── Quantoz EURQ bonus (optional) ──");
  console.log("Set PAYMENT_ASSET=EURQ in .env + get address whitelisted by Quantoz");
  console.log("Docs: https://docs.ai.quantozpay.com/hackathon/guide/\n");
}

main().catch(console.error);
