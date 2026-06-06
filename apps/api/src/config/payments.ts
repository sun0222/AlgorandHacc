import {
  ALGORAND_MAINNET_CAIP2,
  ALGORAND_TESTNET_CAIP2,
  USDC_TESTNET_ASA_ID,
} from "@x402-avm/avm";

/** Quantoz MiCA stablecoins on Algorand mainnet */
export const EURD_MAINNET_ASA_ID = "1221682136";
export const EURQ_MAINNET_ASA_ID = "2768422954";

export type PaymentAsset = "USDC" | "EURQ" | "EURD";

export interface PaymentConfig {
  asset: PaymentAsset;
  network: string;
  asaId: string;
  decimals: number;
  currencySymbol: "€" | "$";
  facilitatorUrl: string;
  prices: {
    packaging: string;
    freight: string;
    checkout: string;
  };
  priceEur: {
    packaging: number;
    freight: number;
    checkout: number;
  };
}

function assetFromEnv(): PaymentAsset {
  const v = (process.env.PAYMENT_ASSET ?? "USDC").toUpperCase();
  if (v === "EURQ" || v === "EURD") return v;
  return "USDC";
}

export function getPaymentConfig(): PaymentConfig {
  const asset = assetFromEnv();

  if (asset === "EURQ") {
    return {
      asset: "EURQ",
      network: ALGORAND_MAINNET_CAIP2,
      asaId: EURQ_MAINNET_ASA_ID,
      decimals: 2,
      currencySymbol: "€",
      facilitatorUrl:
        process.env.FACILITATOR_URL ?? "https://x402algo.ai.quantozpay.com",
      prices: { packaging: "€0.01", freight: "€0.05", checkout: "€0.10" },
      priceEur: { packaging: 0.01, freight: 0.05, checkout: 0.1 },
    };
  }

  if (asset === "EURD") {
    return {
      asset: "EURD",
      network: ALGORAND_MAINNET_CAIP2,
      asaId: EURD_MAINNET_ASA_ID,
      decimals: 2,
      currencySymbol: "€",
      facilitatorUrl:
        process.env.FACILITATOR_URL ?? "https://x402algo.ai.quantozpay.com",
      prices: { packaging: "€0.01", freight: "€0.05", checkout: "€0.10" },
      priceEur: { packaging: 0.01, freight: 0.05, checkout: 0.1 },
    };
  }

  return {
    asset: "USDC",
    network: ALGORAND_TESTNET_CAIP2,
    asaId: USDC_TESTNET_ASA_ID,
    decimals: 6,
    currencySymbol: "$",
    facilitatorUrl:
      process.env.FACILITATOR_URL ?? "https://facilitator.goplausible.xyz",
    prices: { packaging: "$0.01", freight: "$0.05", checkout: "$0.10" },
    priceEur: { packaging: 0.01, freight: 0.05, checkout: 0.1 },
  };
}

export function usesQuantozFacilitator(): boolean {
  return getPaymentConfig().asset !== "USDC";
}

export function getAgentPaymentMode(): "demo" | "quantoz" | "avm" {
  if (process.env.DEMO_MODE === "true") return "demo";
  if (process.env.QUANTOZ_API_KEY && process.env.QUANTOZ_ACCOUNT) return "quantoz";
  if (process.env.AGENT_AVM_PRIVATE_KEY && process.env.RESOURCE_PAY_TO) return "avm";
  return "demo";
}
