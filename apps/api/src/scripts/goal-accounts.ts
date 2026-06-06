/**
 * Create 2 Algorand accounts via goal + kmd and print .env values.
 *
 * Prerequisites: goal installed at tools/node (run once):
 *   cd tools/node && curl -O update.sh && ./update.sh -i -c stable -p $(pwd) -d $(pwd)/data -n
 *
 * Usage: npm run goal:accounts -w @packroute/api
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import algosdk from "algosdk";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const nodeDir = path.join(rootDir, "tools/node");
const goal = path.join(nodeDir, "goal");
const kmd = path.join(nodeDir, "kmd");
const kmdDir = path.join(nodeDir, "data/kmd-v4.7");
const walletName = "packroute";

function run(cmd: string): string {
  return execSync(cmd, { encoding: "utf8", env: process.env }).trim();
}

function extractMnemonic(output: string): string {
  const match = output.match(/"([^"]+)"/);
  if (!match) throw new Error("Could not parse mnemonic from goal output");
  return match[1];
}

function main() {
  if (!fs.existsSync(goal)) {
    console.error("goal not found. Install to tools/node first — see docs/TESTNET_SETUP.md");
    process.exit(1);
  }

  fs.mkdirSync(kmdDir, { recursive: true });

  try {
    run(`"${kmd}" start -t 4002 -d "${kmdDir}"`);
  } catch {
    /* kmd may already be running */
  }

  const wallets = run(`"${goal}" wallet list -k "${kmdDir}"`);
  if (!wallets.includes(walletName)) {
    run(`"${goal}" wallet new ${walletName} -k "${kmdDir}" --unencrypted --no-display-seed`);
  }

  const existing = run(`"${goal}" account list -w ${walletName} -k "${kmdDir}"`);
  const addresses: string[] = [];
  for (const line of existing.split("\n")) {
    const m = line.match(/[A-Z2-7]{58}/);
    if (m) addresses.push(m[0]);
  }

  while (addresses.length < 2) {
    const out = run(`"${goal}" account new -w ${walletName} -k "${kmdDir}"`);
    const m = out.match(/[A-Z2-7]{58}/);
    if (m) addresses.push(m[0]);
  }

  const agentAddr = addresses[0];
  const merchantAddr = addresses[1];

  const agentMnemonic = extractMnemonic(
    run(`"${goal}" account export -a ${agentAddr} -w ${walletName} -k "${kmdDir}"`),
  );
  const merchantMnemonic = extractMnemonic(
    run(`"${goal}" account export -a ${merchantAddr} -w ${walletName} -k "${kmdDir}"`),
  );

  const agentSk = algosdk.mnemonicToSecretKey(agentMnemonic);
  const merchantSk = algosdk.mnemonicToSecretKey(merchantMnemonic);

  console.log("\n=== goal accounts (copy to .env) ===\n");
  console.log(`AGENT_MNEMONIC="${agentMnemonic}"`);
  console.log(`AGENT_ADDRESS=${agentAddr}`);
  console.log(`AGENT_AVM_PRIVATE_KEY=${Buffer.from(agentSk.sk).toString("base64")}`);
  console.log(`MERCHANT_MNEMONIC="${merchantMnemonic}"`);
  console.log(`MERCHANT_ADDRESS=${merchantAddr}`);
  console.log(`MERCHANT_AVM_PRIVATE_KEY=${Buffer.from(merchantSk.sk).toString("base64")}`);
  console.log(`RESOURCE_PAY_TO=${merchantAddr}`);
  console.log("DEMO_MODE=false\n");
}

main();
