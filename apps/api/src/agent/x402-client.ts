import { wrapFetchWithPayment, x402Client } from "@x402-avm/fetch";
import { registerExactAvmScheme } from "@x402-avm/avm/exact/client";
import { toClientAvmSigner } from "@x402-avm/avm";
import { withEurPayment } from "@ever_amsterdam/x402-euro-eurd";
import { getAgentPaymentMode, getPaymentConfig } from "../config/payments.js";

const paymentConfig = () => getPaymentConfig();

const PRICE_BY_PATH: Record<string, keyof ReturnType<typeof getPaymentConfig>["priceEur"]> = {
  "/api/v1/packaging-prices": "packaging",
  "/api/v1/freight-quote": "freight",
  "/api/v1/checkout": "checkout",
};

let fetchWithPay: typeof fetch | null = null;
let quantozFetch: typeof fetch | null = null;
let agentAddress: string | undefined;

export function isDemoMode(): boolean {
  return getAgentPaymentMode() === "demo";
}

export function getAgentAddress(): string | undefined {
  return agentAddress;
}

export function getPaymentInfo() {
  const mode = getAgentPaymentMode();
  const cfg = paymentConfig();
  return {
    mode,
    demo_mode: mode === "demo",
    asset: cfg.asset,
    network: cfg.network,
    currency: cfg.currencySymbol,
    facilitator: cfg.facilitatorUrl,
    prices: cfg.prices,
    quantoz_enabled: mode === "quantoz",
  };
}

export function initX402Client(): void {
  const mode = getAgentPaymentMode();

  if (mode === "demo") {
    console.warn(
      "[PackRoute] DEMO_MODE: simulated x402 — set AGENT_AVM_PRIVATE_KEY + RESOURCE_PAY_TO for TestNet, or QUANTOZ_API_KEY for EUR",
    );
    return;
  }

  if (mode === "quantoz") {
    quantozFetch = withEurPayment(fetch, {
      apiKey: process.env.QUANTOZ_API_KEY!,
      fromAccount: process.env.QUANTOZ_ACCOUNT!,
    });
    console.log("[PackRoute] Quantoz EUR payment client ready (EURO/EURD/EURQ via withEurPayment)");
    return;
  }

  const signer = toClientAvmSigner(process.env.AGENT_AVM_PRIVATE_KEY!);
  agentAddress = signer.address;

  const client = new x402Client();
  registerExactAvmScheme(client, {
    signer,
    algodConfig: {
      algodUrl: process.env.ALGOD_URL ?? "https://testnet-api.algonode.cloud",
      algodToken: process.env.ALGOD_TOKEN ?? "",
    },
  });

  const cfg = paymentConfig();
  const maxAtomic =
    cfg.decimals === 2
      ? BigInt(Number(process.env.MAX_SINGLE_TX_USD ?? 5) * 100)
      : BigInt(Number(process.env.MAX_SINGLE_TX_USD ?? 5) * 1_000_000);

  client.registerPolicy((_version, reqs) =>
    reqs.filter((r) => BigInt(r.amount ?? "0") <= maxAtomic),
  );

  fetchWithPay = wrapFetchWithPayment(fetch, client);
  console.log(`[PackRoute] x402 AVM agent wallet: ${agentAddress} (${cfg.asset})`);
}

function extractTxId(response: Response): string | undefined {
  const paymentResponse =
    response.headers.get("payment-response") ?? response.headers.get("PAYMENT-RESPONSE");
  if (!paymentResponse) return undefined;
  try {
    const decoded = JSON.parse(Buffer.from(paymentResponse, "base64").toString("utf8"));
    return decoded?.transaction ?? decoded?.txId ?? decoded?.tx_id;
  } catch {
    return undefined;
  }
}

function priceForPath(pathname: string): number {
  const key = PRICE_BY_PATH[pathname.split("?")[0]];
  return key ? paymentConfig().priceEur[key] : 0.01;
}

async function demoFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url).pathname;
  const price = priceForPath(path);
  const txId = `DEMO-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (init?.method === "POST" && path === "/api/v1/checkout") {
    const body = init.body ? JSON.parse(init.body as string) : {};
    return new Response(
      JSON.stringify({
        order_id: `ORD-${Date.now()}`,
        status: "confirmed",
        supplier_id: body.supplier_id,
        quantity: body.quantity,
        total_usd: body.total_usd,
        demo: true,
        tx_id: txId,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Demo-Payment": "true",
          "X-Demo-Tx-Id": txId,
          "X-Demo-Amount": String(price),
        },
      },
    );
  }

  const apiBase =
    process.env.API_INTERNAL_URL ?? `http://127.0.0.1:${process.env.API_PORT ?? 4021}`;
  const internalUrl = `${apiBase}${path}${new URL(url).search}`;
  const res = await fetch(internalUrl, {
    headers: { "X-Packroute-Bypass-X402": "true", ...(init?.headers as Record<string, string>) },
    method: init?.method,
    body: init?.body,
  });
  const data = await res.text();
  return new Response(data, {
    status: res.status,
    headers: {
      "Content-Type": "application/json",
      "X-Demo-Payment": "true",
      "X-Demo-Tx-Id": txId,
      "X-Demo-Amount": String(price),
    },
  });
}

function activeFetch(): typeof fetch {
  const mode = getAgentPaymentMode();
  if (mode === "quantoz" && quantozFetch) return quantozFetch;
  if (mode === "avm" && fetchWithPay) return fetchWithPay;
  return demoFetch;
}

export async function paidFetch(
  path: string,
  init?: RequestInit,
): Promise<{ data: unknown; amount_usd: number; tx_id?: string; demo: boolean }> {
  const apiBase = process.env.API_PUBLIC_URL ?? `http://127.0.0.1:${process.env.API_PORT ?? 4021}`;
  const url = `${apiBase}${path}`;
  const amount_usd = priceForPath(path.split("?")[0]);

  const response = await activeFetch()(url, init);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`x402 request failed (${response.status}): ${text}`);
  }

  const demo = isDemoMode() || response.headers.get("X-Demo-Payment") === "true";
  const tx_id =
    response.headers.get("X-Demo-Tx-Id") ?? extractTxId(response) ?? undefined;

  const data = await response.json();
  return { data, amount_usd, tx_id, demo };
}
