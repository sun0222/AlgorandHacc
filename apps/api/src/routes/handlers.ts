import { Request, Response } from "express";
import { PACKAGING_SUPPLIERS, getFreightQuotes } from "@packroute/mocks";

export function healthHandler(_req: Request, res: Response): void {
  res.json({
    service: "packroute-agent-api",
    status: "ok",
    x402: true,
    demo_mode: process.env.DEMO_MODE === "true" || !process.env.AGENT_AVM_PRIVATE_KEY,
  });
}

export function packagingPricesHandler(req: Request, res: Response): void {
  const corridor = String(req.query.corridor ?? "DE-NL");
  res.json({
    suppliers: PACKAGING_SUPPLIERS,
    corridor,
    queried_at: new Date().toISOString(),
    source: "PackRoute EU Packaging Index (mock)",
  });
}

export function freightQuoteHandler(req: Request, res: Response): void {
  const origin = String(req.query.origin ?? "DE");
  const destination = String(req.query.destination ?? "NL");
  const supplier_id = String(req.query.supplier_id ?? "");
  const units = Number(req.query.units ?? 500);
  const weight_kg = Number(req.query.weight_kg ?? units * 0.18);

  const quotes = getFreightQuotes({ origin, destination, weight_kg, units });
  res.json({
    supplier_id,
    quotes,
    corridor: `${origin}-${destination}`,
    queried_at: new Date().toISOString(),
  });
}

export function checkoutHandler(req: Request, res: Response): void {
  const { supplier_id, quantity, total_eur, delivery_by } = req.body ?? {};
  const supplier = PACKAGING_SUPPLIERS.find((s) => s.id === supplier_id);

  if (!supplier) {
    res.status(400).json({ error: "Unknown supplier_id" });
    return;
  }

  const order_id = `PR-${Date.now().toString(36).toUpperCase()}`;
  res.json({
    order_id,
    status: "confirmed",
    supplier_id,
    supplier_name: supplier.name,
    quantity: Number(quantity),
    total_eur: Number(total_eur),
    delivery_by,
    settled_at: new Date().toISOString(),
    payment_rail: "x402-algorand",
  });
}
