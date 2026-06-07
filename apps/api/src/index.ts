import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
dotenv.config({ path: path.join(rootDir, ".env") });

import cors from "cors";
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402-avm/express";
import { registerExactAvmScheme } from "@x402-avm/avm/exact/server";
import { HTTPFacilitatorClient } from "@x402-avm/core/server";
import { agentRouter } from "./routes/agent.js";
import { chatRouter } from "./routes/chat.js";
import {
  checkoutHandler,
  freightQuoteHandler,
  healthHandler,
  packagingPricesHandler,
  marketAnalyticsHandler,
} from "./routes/handlers.js";
import { receiptHandler } from "./routes/receipt.js";
import { initX402Client, isDemoMode } from "./agent/x402-client.js";
import { getPaymentConfig, usesQuantozFacilitator } from "./config/payments.js";

const PORT = Number(process.env.API_PORT ?? 4021);
const PAY_TO = process.env.RESOURCE_PAY_TO ?? "";
const paymentCfg = getPaymentConfig();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    service: "packroute-agent-api",
    status: "ok",
    x402: true,
    demo_mode: isDemoMode(),
    payment: paymentCfg,
  });
});

app.use("/agent", agentRouter);
app.use("/chat", chatRouter);
app.get("/agent/jobs/:id/receipt", receiptHandler);

function buildX402Routes(): Record<string, object> {
  if (!PAY_TO || isDemoMode()) {
    return {};
  }

  const assetExtra = { asset: paymentCfg.asaId, decimals: paymentCfg.decimals };

  return {
    "GET /api/v1/packaging-prices": {
      accepts: {
        scheme: "exact",
        network: paymentCfg.network,
        payTo: PAY_TO,
        price: paymentCfg.prices.packaging,
        extra: assetExtra,
      },
      description: "EU F&B packaging supplier price index",
      unpaidResponseBody: () => ({
        contentType: "application/json",
        body: {
          message: `Pay ${paymentCfg.prices.packaging} ${paymentCfg.asset} for packaging supplier prices`,
          preview: { suppliers_count: 4, corridor: "DE-NL" },
        },
      }),
    },
    "GET /api/v1/freight-quote": {
      accepts: {
        scheme: "exact",
        network: paymentCfg.network,
        payTo: PAY_TO,
        price: paymentCfg.prices.freight,
        extra: assetExtra,
      },
      description: "Cross-border EU freight quote (DE↔NL corridor)",
      unpaidResponseBody: () => ({
        contentType: "application/json",
        body: { message: `Pay ${paymentCfg.prices.freight} ${paymentCfg.asset} for freight quotes` },
      }),
    },
    "POST /api/v1/checkout": {
      accepts: {
        scheme: "exact",
        network: paymentCfg.network,
        payTo: PAY_TO,
        price: paymentCfg.prices.checkout,
        extra: assetExtra,
      },
      description: "Supplier checkout settlement via x402",
      unpaidResponseBody: () => ({
        contentType: "application/json",
        body: { message: `Pay ${paymentCfg.prices.checkout} ${paymentCfg.asset} to confirm supplier order` },
      }),
    },
  };
}

const x402Routes = buildX402Routes();

if (Object.keys(x402Routes).length > 0) {
  const facilitatorClient = new HTTPFacilitatorClient({ url: paymentCfg.facilitatorUrl });
  const server = new x402ResourceServer(facilitatorClient);
  registerExactAvmScheme(server);
  app.use(paymentMiddleware(x402Routes as Parameters<typeof paymentMiddleware>[0], server));
  console.log(
    `[PackRoute] x402 active → ${paymentCfg.asset} via ${usesQuantozFacilitator() ? "Quantoz" : "GoPlausible"} facilitator`,
  );
  console.log(`[PackRoute] payTo: ${PAY_TO.slice(0, 10)}...`);
} else {
  console.warn("[PackRoute] x402 middleware disabled (DEMO_MODE or missing RESOURCE_PAY_TO)");
}

app.get("/api/v1/packaging-prices", packagingPricesHandler);
app.get("/api/v1/freight-quote", freightQuoteHandler);
app.post("/api/v1/checkout", checkoutHandler);
app.get("/api/v1/market-analytics", marketAnalyticsHandler);

initX402Client();

app.listen(PORT, () => {
  console.log(`\n🚀 PackRoute API http://localhost:${PORT}`);
  console.log(`   Dashboard   http://localhost:${process.env.WEB_PORT ?? 3000}`);
  console.log(`   Payment     ${paymentCfg.asset} (${isDemoMode() ? "DEMO" : "LIVE"})`);
  console.log(`   Facilitator ${paymentCfg.facilitatorUrl}\n`);
});
