import { Request, Response } from "express";
import PDFDocument from "pdfkit";
import { getJob } from "../store/jobs.js";

const LORA = "https://lora.algokit.io/testnet/transaction";
const LORA_HOME = "https://lora.algokit.io/testnet";

// Brand colours
const TEAL = "#00c2a8";
const DARK = "#0c0f14";
const MUTED = "#8b95a8";
const SUCCESS = "#3dd68c";
const ERROR = "#ff5c5c";
const WARN = "#f5a623";

function rule(doc: PDFKit.PDFDocument, y?: number): void {
  const top = y ?? doc.y;
  doc.moveTo(40, top).lineTo(572, top).stroke("#2a3344").moveDown(0.1);
}

function sectionHeader(doc: PDFKit.PDFDocument, title: string): void {
  doc.moveDown(0.5);
  rule(doc);
  doc.moveDown(0.4);
  doc.fontSize(11).font("Helvetica-Bold").fillColor(TEAL).text(title.toUpperCase());
  doc.fillColor("black").moveDown(0.35);
}

function kv(doc: PDFKit.PDFDocument, key: string, value: string, indent = 40): void {
  const savedX = doc.x;
  doc
    .fontSize(9)
    .font("Helvetica-Bold")
    .fillColor(MUTED)
    .text(key, indent, doc.y, { continued: true, width: 130 });
  doc.font("Helvetica").fillColor("#1a1a1a").text(value);
  doc.x = savedX;
}

function stepIcon(status: string): { char: string; color: string } {
  if (status === "done") return { char: "✓", color: SUCCESS };
  if (status === "error") return { char: "✗", color: ERROR };
  if (status === "running") return { char: "…", color: TEAL };
  return { char: "○", color: MUTED };
}

function tableRow(
  doc: PDFKit.PDFDocument,
  cols: { text: string; x: number; width: number; bold?: boolean; color?: string }[],
  rowY: number,
): void {
  cols.forEach((c) => {
    doc
      .fontSize(9)
      .font(c.bold ? "Helvetica-Bold" : "Helvetica")
      .fillColor(c.color ?? "#1a1a1a")
      .text(c.text, c.x, rowY, { width: c.width, lineBreak: false });
  });
}

export function receiptHandler(req: Request, res: Response): void {
  const jobId = String(req.params.id ?? "");
  const job = getJob(jobId);

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="packroute-receipt-${jobId.slice(0, 8)}.pdf"`,
  );

  const doc = new PDFDocument({ margin: 40, size: "A4" });
  doc.pipe(res);

  // ── Cover header bar ────────────────────────────────────────────────────────
  doc.rect(0, 0, 595, 72).fill(DARK);
  doc
    .fontSize(20)
    .font("Helvetica-Bold")
    .fillColor(TEAL)
    .text("PackRoute Agent", 40, 18, { continued: true });
  doc.fontSize(10).font("Helvetica").fillColor("#8b95a8").text("  ·  Job Receipt", { baseline: "bottom" });
  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor("#8b95a8")
    .text("Autonomous EU packaging procurement via x402 · USDC on Algorand Testnet", 40, 46);
  doc.fillColor("black");

  // Status pill
  const statusColor =
    job.status === "completed" ? SUCCESS : job.status === "failed" ? ERROR : WARN;
  doc
    .roundedRect(432, 20, 120, 22, 4)
    .fill(statusColor + "22");
  doc
    .fontSize(9)
    .font("Helvetica-Bold")
    .fillColor(statusColor)
    .text(job.status.toUpperCase(), 432, 27, { width: 120, align: "center" });
  doc.fillColor("black");

  doc.y = 90;

  // ── Job details ─────────────────────────────────────────────────────────────
  sectionHeader(doc, "Job Details");
  kv(doc, "Job ID", job.id);
  kv(doc, "Created", new Date(job.created_at).toUTCString());
  kv(doc, "Completed", new Date(job.updated_at).toUTCString());

  if (job.rules) {
    doc.moveDown(0.4);
    doc.fontSize(9).font("Helvetica-Bold").fillColor(MUTED).text("ORDER REQUEST", 40);
    doc.fillColor("black").moveDown(0.15);
    kv(doc, "Product", job.rules.product);
    kv(doc, "Quantity", `${job.rules.quantity.toLocaleString()} units`);
    kv(doc, "Max Unit Price", `$${job.rules.max_unit_price_usd.toFixed(2)} USD`);
    kv(doc, "Trade Corridor", job.rules.corridor);
    kv(doc, "Deliver By", job.rules.delivery_by);
  }

  // ── Procurement steps ────────────────────────────────────────────────────────
  sectionHeader(doc, "Procurement Steps");

  (job.steps ?? []).forEach((s) => {
    const { char, color } = stepIcon(s.status);
    const rowY = doc.y;

    doc.fontSize(11).font("Helvetica-Bold").fillColor(color).text(char, 40, rowY, { width: 18, lineBreak: false });
    doc.fontSize(10).font("Helvetica-Bold").fillColor("#1a1a1a").text(s.label, 62, rowY, { width: 340, lineBreak: false });
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor(color)
      .text(`[${s.status}]`, 410, rowY, { width: 80, align: "right" });
    doc.fillColor("black");
    doc.moveDown(0.2);

    if (s.detail) {
      doc.fontSize(9).font("Helvetica").fillColor(MUTED).text(s.detail, 62, doc.y);
      doc.fillColor("black").moveDown(0.15);
    }

    if (s.tx_id && !s.tx_id.startsWith("DEMO")) {
      const txUrl = `${LORA}/${s.tx_id}`;
      const shortId = s.tx_id.slice(0, 12) + "…" + s.tx_id.slice(-6);
      doc.fontSize(9).font("Helvetica-Bold").fillColor(TEAL).text("↗ Lora Testnet: ", 62, doc.y, { continued: true });
      doc
        .font("Helvetica")
        .fillColor("#1a6fa8")
        .text(`${shortId}`, { link: txUrl, underline: true, continued: true });
      doc.fillColor(MUTED).font("Helvetica").text(`  (${txUrl})`, { link: txUrl, underline: false });
      doc.fillColor("black").moveDown(0.15);
    } else if (s.tx_id?.startsWith("DEMO")) {
      doc.fontSize(9).font("Helvetica").fillColor(MUTED).text("↗ Demo transaction (simulated — no blockchain record)", 62, doc.y);
      doc.fillColor("black").moveDown(0.15);
    }

    if (s.amount_usd !== undefined) {
      doc.fontSize(9).font("Helvetica").fillColor(MUTED).text(`Payment: $${s.amount_usd.toFixed(4)} USD`, 62, doc.y);
      doc.fillColor("black").moveDown(0.15);
    }

    doc.moveDown(0.25);
  });

  // ── Payment ledger ───────────────────────────────────────────────────────────
  sectionHeader(doc, "x402 Payment Ledger");

  const spends = job.spends ?? [];
  const totalSpend = spends.reduce((s, p) => s + (p.amount_usd ?? 0), 0);
  const onChainCount = spends.filter((p) => !p.demo).length;
  const demoCount = spends.filter((p) => p.demo).length;

  if (spends.length === 0) {
    doc.fontSize(9).font("Helvetica").fillColor(MUTED).text("No payment records.");
    doc.fillColor("black").moveDown(0.4);
  } else {
    // Table header
    const COL = { num: 40, endpoint: 58, ts: 230, amt: 360, type: 415 };
    const headerY = doc.y;
    doc.rect(40, headerY - 3, 532, 18).fill("#f0f4f8");
    tableRow(doc, [
      { text: "#",         x: COL.num,      width: 16,  bold: true, color: MUTED },
      { text: "Endpoint",  x: COL.endpoint, width: 168, bold: true, color: MUTED },
      { text: "Timestamp", x: COL.ts,       width: 126, bold: true, color: MUTED },
      { text: "Amount",    x: COL.amt,       width: 50,  bold: true, color: MUTED },
      { text: "Type",      x: COL.type,      width: 80,  bold: true, color: MUTED },
    ], headerY);
    doc.moveDown(0.9);

    spends.forEach((p, i) => {
      const rowY = doc.y;
      const typeLabel = p.demo ? "DEMO" : "ON-CHAIN";
      const typeColor = p.demo ? WARN : SUCCESS;
      const ts = new Date(p.timestamp).toISOString().replace("T", " ").slice(0, 19);

      // Alternating row background
      if (i % 2 === 0) doc.rect(40, rowY - 2, 532, 16).fill("#fafbfc");

      tableRow(doc, [
        { text: String(i + 1),               x: COL.num,      width: 16 },
        { text: p.endpoint.split("?")[0],    x: COL.endpoint, width: 168 },
        { text: ts,                           x: COL.ts,       width: 126, color: MUTED },
        { text: `$${(p.amount_usd ?? 0).toFixed(4)}`, x: COL.amt, width: 50, bold: true },
        { text: typeLabel,                    x: COL.type,     width: 80, bold: true, color: typeColor },
      ], rowY);
      doc.moveDown(0.75);

      // Lora tx link on next line
      if (p.tx_id && !p.tx_id.startsWith("DEMO")) {
        const txUrl = `${LORA}/${p.tx_id}`;
        const shortId = p.tx_id.slice(0, 14) + "…" + p.tx_id.slice(-6);
        doc.fontSize(8).font("Helvetica-Bold").fillColor(TEAL).text("   ↗ Lora: ", COL.endpoint, doc.y, { continued: true, width: 60, lineBreak: false });
        doc
          .font("Helvetica")
          .fillColor("#1a6fa8")
          .text(shortId, { continued: true, link: txUrl, underline: true });
        doc.fillColor(MUTED).text(`  ${txUrl}`, { link: txUrl, underline: false });
        doc.fillColor("black").moveDown(0.4);
      } else if (p.tx_id?.startsWith("DEMO")) {
        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor(MUTED)
          .text(`   Demo TX: ${p.tx_id} (simulated)`, COL.endpoint, doc.y);
        doc.fillColor("black").moveDown(0.4);
      }
    });

    // Total row
    doc.moveDown(0.2);
    const totalY = doc.y;
    doc.rect(40, totalY - 2, 532, 20).fill(TEAL + "18");
    tableRow(doc, [
      { text: "TOTAL", x: COL.endpoint, width: 200, bold: true, color: DARK },
      { text: `$${totalSpend.toFixed(4)} USD`, x: COL.amt - 10, width: 90, bold: true, color: DARK },
      { text: `${onChainCount} on-chain  |  ${demoCount} demo`, x: COL.type - 20, width: 160, color: MUTED },
    ], totalY);
    doc.moveDown(1.1);
  }

  // ── Order result ─────────────────────────────────────────────────────────────
  if (job.result) {
    sectionHeader(doc, "Order Result");

    // Result highlight box
    const boxY = doc.y;
    doc.rect(40, boxY, 532, 80).fill("#f6fffe").stroke(TEAL + "44");
    doc.fillColor("black");

    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .fillColor(DARK)
      .text(`Order ${job.result.order_id}`, 55, boxY + 10, { continued: true });
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor(MUTED)
      .text(`  ·  ${job.result.supplier_name}`);

    doc
      .fontSize(18)
      .font("Helvetica-Bold")
      .fillColor(SUCCESS)
      .text(`$${job.result.total_usd.toFixed(2)} USD`, 55, boxY + 34);

    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor(MUTED)
      .text(
        `${job.result.quantity.toLocaleString()} units × $${job.result.unit_price_usd.toFixed(4)}  +  freight $${job.result.freight_usd.toFixed(2)}`,
        55,
        boxY + 58,
      );

    doc.y = boxY + 88;
    doc.fillColor("black").moveDown(0.5);

    doc.fontSize(9).font("Helvetica").fillColor(MUTED).text(job.result.explanation ?? "");
    doc.fillColor("black").moveDown(0.4);

    if (job.result.analytics_insight) {
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor(MUTED)
        .text(`Market insight: ${job.result.analytics_insight}`);
      doc.fillColor("black").moveDown(0.3);
    }
  }

  // ── Blockchain explorer note ──────────────────────────────────────────────────
  sectionHeader(doc, "Verify on Algorand Testnet");

  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor("#1a1a1a")
    .text("All on-chain payments are settled in USDC on the Algorand Testnet. Verify any transaction at:");
  doc.moveDown(0.2);
  doc
    .fontSize(9)
    .font("Helvetica-Bold")
    .fillColor("#1a6fa8")
    .text(LORA_HOME, { link: LORA_HOME, underline: true });
  doc.fillColor("black").moveDown(0.4);
  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor(MUTED)
    .text("To verify a specific payment: paste the TX ID at  " + LORA_HOME + "  →  Transactions → search by ID.");
  doc.fillColor("black");

  // ── Footer ───────────────────────────────────────────────────────────────────
  doc.moveDown(0.8);
  const pageH = doc.page.height;
  doc.rect(0, pageH - 36, 595, 36).fill(DARK);
  doc
    .fontSize(8)
    .font("Helvetica")
    .fillColor("#8b95a8")
    .text(
      `Generated by PackRoute Agent  ·  ${new Date().toUTCString()}  ·  No subscriptions — pay per request with USDC on Algorand`,
      40,
      pageH - 24,
      { width: 515, align: "center" },
    );

  doc.end();
}
