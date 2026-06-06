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
  total_eur: number;
  tx_id?: string;
}

interface Candidate {
  supplier_id: string;
  supplier_name: string;
  unit_price_eur: number;
  freight_eur: number;
  total_eur: number;
  eta_days: number;
}

function parseCorridor(corridor: string): { origin: string; destination: string } {
  const [origin, destination] = corridor.split("-").map((s) => s.trim().toUpperCase());
  return { origin: origin ?? "DE", destination: destination ?? "NL" };
}

function buildExplanation(winner: Candidate, rules: AgentRules): string {
  return (
    `Selected ${winner.supplier_name} at €${winner.unit_price_eur.toFixed(2)}/unit + €${winner.freight_eur.toFixed(2)} freight. ` +
    `Landed total €${winner.total_eur.toFixed(2)} for ${rules.quantity} units (${rules.corridor}), within max €${rules.max_unit_price_eur}/unit.`
  );
}

async function payAndLog(
  jobId: string,
  endpoint: string,
  category: "api" | "checkout",
  fn: () => Promise<{ data: unknown; amount_usd: number; tx_id?: string; demo: boolean }>,
): Promise<unknown> {
  const preview = endpoint.includes("checkout") ? 0.1 : endpoint.includes("freight") ? 0.05 : 0.01;
  assertCanSpend(preview, category);
  const result = await fn();
  assertCanSpend(result.amount_usd, category);
  recordSpend(result.amount_usd);
  addSpend(jobId, {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    endpoint,
    amount_usd: result.amount_usd,
    tx_id: result.tx_id,
    demo: result.demo,
  });
  return result.data;
}

export async function runProcurementJob(jobId: string, rules: AgentRules): Promise<void> {
  updateJob(jobId, { status: "running" });

  try {
    updateStep(jobId, "prices", { status: "running" });
    const priceData = (await payAndLog(jobId, "/api/v1/packaging-prices", "api", () =>
      paidFetch(`/api/v1/packaging-prices?corridor=${encodeURIComponent(rules.corridor)}`),
    )) as PriceResponse;

    const eligible = priceData.suppliers.filter(
      (s) =>
        s.food_grade &&
        s.unit_price_eur <= rules.max_unit_price_eur &&
        rules.quantity >= s.moq,
    );

    if (eligible.length === 0) {
      throw new Error(
        `No suppliers match: max €${rules.max_unit_price_eur}/unit, MOQ for qty ${rules.quantity}`,
      );
    }

    updateStep(jobId, "prices", {
      status: "done",
      detail: `${eligible.length} eligible suppliers from x402 price feed`,
    });

    updateStep(jobId, "freight", { status: "running" });
    const { origin, destination } = parseCorridor(rules.corridor);
    const weight_kg = rules.quantity * 0.18;

    const topSuppliers = [...eligible].sort((a, b) => a.unit_price_eur - b.unit_price_eur).slice(0, 2);
    const freightBySupplier: Record<string, FreightResponse> = {};

    for (const supplier of topSuppliers) {
      const freightData = (await payAndLog(
        jobId,
        `/api/v1/freight-quote?supplier=${supplier.id}`,
        "api",
        () =>
          paidFetch(
            `/api/v1/freight-quote?origin=${origin}&destination=${destination}&supplier_id=${supplier.id}&units=${rules.quantity}&weight_kg=${weight_kg}`,
          ),
      )) as FreightResponse;
      freightBySupplier[supplier.id] = freightData;
    }

    updateStep(jobId, "freight", {
      status: "done",
      detail: `Freight quotes for ${topSuppliers.length} suppliers (DE→${destination})`,
    });

    updateStep(jobId, "compare", { status: "running" });

    const candidates: Candidate[] = topSuppliers.map((supplier) => {
      const quotes = freightBySupplier[supplier.id]?.quotes ?? [];
      const cheapestFreight = [...quotes].sort((a, b) => a.cost_eur - b.cost_eur)[0];
      const freight_eur = cheapestFreight?.cost_eur ?? 999;
      const total_eur =
        Math.round((supplier.unit_price_eur * rules.quantity + freight_eur) * 100) / 100;
      return {
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        unit_price_eur: supplier.unit_price_eur,
        freight_eur,
        total_eur,
        eta_days: cheapestFreight?.eta_days ?? 99,
      };
    });

    const winner = [...candidates].sort((a, b) => a.total_eur - b.total_eur)[0];
    updateStep(jobId, "compare", {
      status: "done",
      detail: `Best: ${winner.supplier_name} — €${winner.total_eur} landed`,
    });

    updateStep(jobId, "checkout", { status: "running" });
    const checkout = (await payAndLog(jobId, "/api/v1/checkout", "checkout", () =>
      paidFetch("/api/v1/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_id: winner.supplier_id,
          quantity: rules.quantity,
          total_eur: winner.total_eur,
          delivery_by: rules.delivery_by,
        }),
      }),
    )) as CheckoutResponse;

    updateStep(jobId, "checkout", {
      status: "done",
      detail: `Order ${checkout.order_id} confirmed`,
      tx_id: checkout.tx_id,
      amount_usd: 0.1,
    });

    const result: JobResult = {
      supplier_id: winner.supplier_id,
      supplier_name: winner.supplier_name,
      unit_price_eur: winner.unit_price_eur,
      quantity: rules.quantity,
      freight_eur: winner.freight_eur,
      total_eur: winner.total_eur,
      order_id: checkout.order_id,
      explanation: buildExplanation(winner, rules),
    };

    updateJob(jobId, { status: "completed", result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    updateJob(jobId, { status: "failed", error: message });
    const runningStep = ["prices", "freight", "compare", "checkout"].find((id) => {
      return true;
    });
    void runningStep;
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
