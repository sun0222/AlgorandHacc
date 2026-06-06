import algosdk from "algosdk";

function main() {
  const account = algosdk.generateAccount();
  const privateKeyB64 = Buffer.from(account.sk).toString("base64");

  console.log("\n=== PackRoute Agent Wallet Generated ===\n");
  console.log("Address:", account.addr);
  console.log("\nAdd to .env:\n");
  console.log(`AGENT_AVM_PRIVATE_KEY=${privateKeyB64}`);
  console.log(`RESOURCE_PAY_TO=${account.addr}`);
  console.log("\nFund this address on TestNet:");
  console.log("- ALGO: https://lora.algokit.io/ (TestNet faucet)");
  console.log("- USDC: https://faucet.circle.com/ (Algorand TestNet)\n");
}

main();
