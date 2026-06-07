import { PACKAGING_SUPPLIERS, getFreightQuotes } from "@packroute/mocks";
import type { AgentRules, JobResult } from "../store/jobs.js";
import { addSpend, updateJob, updateStep } from "../store/jobs.js";
import { assertCanSpend, recordSpend } from "./wallet.js";
import { paidFetch } from "./x402-client.js";

interface PriceResponse {
  suppliers: typeof PACKAGING_SUPPLIERS;
  corridor: string;
  queried_at: string;
}

interface FreightResponse {
  quotes: ReturnType<typeof getFreightQuotes>;
  supplier_id: string;
}

interface CheckoutResponse {
  order_id: string;
  status: string;
  supplier_id: string;
  quantity: number;
  total_usd: number;
  tx_id?: string;
}

interface Candidate {
  supplier_id: string;
  supplier_name: string;
  unit_price_usd: number;
  freight_usd: number;
  total_usd: number;
  eta_days: number;
}

function parseCorridor(corridor: string): { origin: string; destination: string } {
  const [origin, destination] = corridor.split("-").map((s) => s.trim().toUpperCase());
  return { origin: origin ?? "DE", destination: destination ?? "NL" };
}

function buildExplanation(winner: Candidate, rules: AgentRules, analyticsInsight?: string): string {
  let text =
    `Selected ${winner.supplier_name} at $${winner.unit_price_usd.toFixed(2)}/unit + $${winner.freight_usd.toFixed(2)} freight. ` +
    `Landed total $${winner.total_usd.toFixed(2)} for ${rules.quantity} units (${rules.corridor}), within max $${rules.max_unit_price_usd}/unit.`;
  if (analyticsInsight) {
    text += ` Market insight: ${analyticsInsight}`;
  }
  return text;
}

async function payAndLog(
  jobId: string,
  endpoint: string,
  category: "api" | "checkout",
  fn: () => Promise<{ data: unknown; amount_usd: number; tx_id?: string; demo: boolean }>,
): Promise<{ data: unknown; tx_id?: string; amount_usd: number }> {
  const preview = endpoint.includes("checkout") ? 0.1 : endpoint.includes("freight") ? 0.05 : 0.01;
  assertCanSpend(preview, category);
  const result = await fn();
  assertCanSpend(result.amount_usd, category);
  recordSpend(result.amount_usd, category);
  addSpend(jobId, {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    endpoint,
    amount_usd: result.amount_usd,
    tx_id: result.tx_id,
    demo: result.demo,
  });
  return { data: result.data, tx_id: result.tx_id, amount_usd: result.amount_usd };
}

export async function runProcurementJob(jobId: string, rules: AgentRules): Promise<void> {
  updateJob(jobId, { status: "running" });

  try {
    updateStep(jobId, "prices", { status: "running" });
    const { data: priceRaw } = await payAndLog(jobId, "/api/v1/packaging-prices", "api", () =>
      paidFetch(`/api/v1/packaging-prices?corridor=${encodeURIComponent(rules.corridor)}`),
    );
    const priceData = priceRaw as PriceResponse;

    const eligible = priceData.suppliers.filter(
      (s) =>
        s.food_grade &&
        s.unit_price_usd <= rules.max_unit_price_usd &&
        rules.quantity >= s.moq,
    );

    if (eligible.length === 0) {
      throw new Error(
        `No suppliers match: max $${rules.max_unit_price_usd}/unit, MOQ for qty ${rules.quantity}`,
      );
    }

    updateStep(jobId, "prices", {
      status: "done",
      detail: `${eligible.length} eligible suppliers from x402 price feed`,
    });

    updateStep(jobId, "freight", { status: "running" });
    const { origin, destination } = parseCorridor(rules.corridor);
    const weight_kg = rules.quantity * 0.18;

    const topSuppliers = [...eligible].sort((a, b) => a.unit_price_usd - b.unit_price_usd).slice(0, 2);
    const freightBySupplier: Record<string, FreightResponse> = {};

    for (const supplier of topSuppliers) {
      const { data: freightRaw } = await payAndLog(
        jobId,
        `/api/v1/freight-quote?supplier=${supplier.id}`,
        "api",
        () =>
          paidFetch(
            `/api/v1/freight-quote?origin=${origin}&destination=${destination}&supplier_id=${supplier.id}&units=${rules.quantity}&weight_kg=${weight_kg}`,
          ),
      );
      freightBySupplier[supplier.id] = freightRaw as FreightResponse;
    }

    updateStep(jobId, "freight", {
      status: "done",
      detail: `Freight quotes for ${topSuppliers.length} suppliers (DE→${destination})`,
    });

    updateStep(jobId, "compare", { status: "running" });

    const candidates: Candidate[] = topSuppliers.map((supplier) => {
      const quotes = freightBySupplier[supplier.id]?.quotes ?? [];
      const cheapestFreight = [...quotes].sort((a, b) => a.cost_usd - b.cost_usd)[0];
      const freight_usd = cheapestFreight?.cost_usd ?? 999;
      const total_usd =
        Math.round((supplier.unit_price_usd * rules.quantity + freight_usd) * 100) / 100;
      return {
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        unit_price_usd: supplier.unit_price_usd,
        freight_usd,
        total_usd,
        eta_days: cheapestFreight?.eta_days ?? 99,
      };
    });

    const winner = [...candidates].sort((a, b) => a.total_usd - b.total_usd)[0];
    updateStep(jobId, "compare", {
      status: "done",
      detail: `Best: ${winner.supplier_name} — $${winner.total_usd} landed`,
    });

    updateStep(jobId, "checkout", { status: "running" });
    const { data: checkoutRaw, tx_id: checkoutTxId, amount_usd: checkoutAmount } = await payAndLog(
      jobId,
      "/api/v1/checkout",
      "checkout",
      () =>
        paidFetch("/api/v1/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            supplier_id: winner.supplier_id,
            quantity: rules.quantity,
            total_usd: winner.total_usd,
            delivery_by: rules.delivery_by,
          }),
        }),
    );
    const checkout = checkoutRaw as CheckoutResponse;

    updateStep(jobId, "checkout", {
      status: "done",
      detail: `Order ${checkout.order_id} confirmed`,
      tx_id: checkoutTxId ?? checkout.tx_id,
      amount_usd: checkoutAmount,
    });

    const result: JobResult = {
      supplier_id: winner.supplier_id,
      supplier_name: winner.supplier_name,
      unit_price_usd: winner.unit_price_usd,
      quantity: rules.quantity,
      freight_usd: winner.freight_usd,
      total_usd: winner.total_usd,
      order_id: checkout.order_id,
      explanation: buildExplanation(winner, rules),
    };

    updateJob(jobId, { status: "completed", result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    updateJob(jobId, { status: "failed", error: message });
    for (const stepId of ["prices", "freight", "compare", "checkout"] as const) {
      const job = updateJob(jobId, {});
      const step = job?.steps.find((s) => s.id === stepId);
      if (step && step.status === "running") {
        updateStep(jobId, stepId, { status: "error", detail: message });
        break;
      }
    }
  }
}
