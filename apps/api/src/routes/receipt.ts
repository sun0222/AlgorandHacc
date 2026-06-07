import { Request, Response } from "express";
import PDFDocument from "pdfkit";
import { getJob } from "../store/jobs.js";

const LORA_BASE = "https://lora.algokit.io/testnet/transaction";

export function receiptHandler(req: Request, res: Response): void {
  const jobId = String(req.params.id ?? "");
  const job = getJob(jobId);

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="job-${jobId}-receipt.pdf"`);

  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(res);

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.fontSize(18).font("Helvetica-Bold").text("PackRoute Agent — Job Receipt", { underline: false });
  doc.moveDown(0.3);
  doc.fontSize(10).font("Helvetica").fillColor("gray").text("Pay-per-request logistics powered by USDC on Algorand Testnet");
  doc.fillColor("black");
  doc.moveDown(0.6);

  // ── Job metadata ────────────────────────────────────────────────────────────
  doc.fontSize(12).font("Helvetica-Bold").text("Job Details");
  doc.moveDown(0.2);
  doc.fontSize(10).font("Helvetica");
  doc.text(`Job ID:     ${job.id}`);
  doc.text(`Status:     ${job.status}`);
  doc.text(`Created:    ${job.created_at}`);
  doc.text(`Updated:    ${job.updated_at}`);
  if (job.rules) {
    doc.moveDown(0.3);
    doc.font("Helvetica-Bold").text("Order Rules:");
    doc.font("Helvetica");
    doc.text(`  Product:         ${job.rules.product}`);
    doc.text(`  Quantity:        ${job.rules.quantity} units`);
    doc.text(`  Max Unit Price:  $${job.rules.max_unit_price_usd.toFixed(2)} USD`);
    doc.text(`  Corridor:        ${job.rules.corridor}`);
    doc.text(`  Deliver By:      ${job.rules.delivery_by}`);
  }
  doc.moveDown(0.6);

  // ── Agent steps ─────────────────────────────────────────────────────────────
  doc.fontSize(12).font("Helvetica-Bold").text("Agent Steps");
  doc.moveDown(0.2);
  (job.steps || []).forEach((s) => {
    const icon = s.status === "done" ? "✓" : s.status === "error" ? "✗" : "○";
    doc.fontSize(10).font("Helvetica-Bold").text(`  ${icon} ${s.label}`, { continued: true });
    doc.font("Helvetica").fillColor(
      s.status === "done" ? "green" : s.status === "error" ? "red" : "gray"
    ).text(`  [${s.status}]`);
    doc.fillColor("black");
    if (s.detail) {
      doc.fontSize(9).fillColor("gray").font("Helvetica").text(`     ${s.detail}`);
      doc.fillColor("black");
    }
    if (s.tx_id) {
      const txUrl = `${LORA_BASE}/${s.tx_id}`;
      doc.fontSize(9).fillColor("blue").text(`     Algorand Tx: ${txUrl}`, { link: txUrl, underline: true });
      doc.fillColor("black");
    }
    if (s.amount_usd !== undefined) {
      doc.fontSize(9).text(`     Amount: $${s.amount_usd.toFixed(4)} USD`);
    }
    doc.moveDown(0.2);
  });
  doc.moveDown(0.4);

  // ── Payment / spend ledger ───────────────────────────────────────────────────
  doc.fontSize(12).font("Helvetica-Bold").text("Payment Ledger (x402 Micro-Payments)");
  doc.moveDown(0.2);

  const totalSpend = (job.spends || []).reduce((sum, p) => sum + (p.amount_usd || 0), 0);
  const realSpends = (job.spends || []).filter((p) => !p.demo);
  const demoSpends = (job.spends || []).filter((p) => p.demo);

  if ((job.spends || []).length === 0) {
    doc.fontSize(10).font("Helvetica").fillColor("gray").text("  No payment records yet.");
    doc.fillColor("black");
  }

  (job.spends || []).forEach((p, i) => {
    const endpoint = p.endpoint.split("?")[0];
    const label = p.demo ? "(demo / simulated)" : "(on-chain USDC)";
    doc.fontSize(10).font("Helvetica-Bold").text(`  ${i + 1}. ${endpoint}`);
    doc.font("Helvetica").fontSize(9);
    doc.text(`     Timestamp:  ${p.timestamp}`);
    doc.text(`     Amount:     $${(p.amount_usd || 0).toFixed(4)} USD  ${label}`);
    if (p.tx_id && !p.tx_id.startsWith("DEMO")) {
      const txUrl = `${LORA_BASE}/${p.tx_id}`;
      doc.fillColor("blue").text(`     Lora TX:    ${txUrl}`, { link: txUrl, underline: true });
      doc.fillColor("black");
    } else if (p.tx_id) {
      doc.fillColor("gray").text(`     TX ID:      ${p.tx_id} (simulated)`);
      doc.fillColor("black");
    }
    doc.moveDown(0.3);
  });

  doc.moveDown(0.2);
  doc.fontSize(10).font("Helvetica-Bold")
    .text(`On-chain payments: ${realSpends.length}   Demo/simulated: ${demoSpends.length}   Total spend: $${totalSpend.toFixed(4)} USD`);
  doc.font("Helvetica");
  doc.moveDown(0.6);

  // ── Order result ─────────────────────────────────────────────────────────────
  if (job.result) {
    doc.fontSize(12).font("Helvetica-Bold").text("Order Result");
    doc.moveDown(0.2);
    doc.fontSize(10).font("Helvetica");
    doc.text(`  Order ID:         ${job.result.order_id}`);
    doc.text(`  Supplier:         ${job.result.supplier_name}`);
    doc.text(`  Unit Price:       $${job.result.unit_price_usd.toFixed(4)} USD`);
    doc.text(`  Quantity:         ${job.result.quantity} units`);
    doc.text(`  Freight Cost:     $${job.result.freight_usd.toFixed(2)} USD`);
    doc.fontSize(11).font("Helvetica-Bold")
      .text(`  Total Order Value: $${job.result.total_usd.toFixed(2)} USD`);
    doc.font("Helvetica").fontSize(10);
    if (job.result.analytics_insight) {
      doc.moveDown(0.3);
      doc.fontSize(9).fillColor("gray").text(`  Insight: ${job.result.analytics_insight}`);
      doc.fillColor("black");
    }
    if (job.result.explanation) {
      doc.moveDown(0.2);
      doc.fontSize(9).fillColor("gray").text(job.result.explanation);
      doc.fillColor("black");
    }
    doc.moveDown(0.6);
  }

  // ── Algorand testnet note ─────────────────────────────────────────────────────
  doc.fontSize(9).fillColor("gray");
  doc.text("All on-chain transactions are on the Algorand Testnet. Verify via:");
  doc.fillColor("blue").text("https://lora.algokit.io/testnet", {
    link: "https://lora.algokit.io/testnet",
    underline: true,
  });
  doc.fillColor("gray").moveDown(0.3);
  doc.text("Generated by PackRoute Agent | No subscriptions, no API keys · Pay per request with USDC on Algorand");
  doc.fillColor("black");

  doc.end();
}
