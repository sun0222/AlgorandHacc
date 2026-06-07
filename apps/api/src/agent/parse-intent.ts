import type { PendingProcurement } from "../store/sessions.js";
import type { AgentRules } from "../store/jobs.js";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const OTP_RE = /^\s*(\d{6})\s*$/;

const CORRIDOR_MAP: Record<string, string> = {
  "de-nl": "DE-NL",
  "de-fr": "DE-FR",
  "de-it": "DE-IT",
  "germany netherlands": "DE-NL",
  "germany france": "DE-FR",
  "germany italy": "DE-IT",
  "de to nl": "DE-NL",
  "de to fr": "DE-FR",
};

export function extractEmail(text: string): string | null {
  const m = text.match(EMAIL_RE);
  return m ? m[0].toLowerCase() : null;
}

export function extractOtp(text: string): string | null {
  const m = text.match(OTP_RE);
  return m ? m[1] : null;
}

export function parseProcurementIntent(text: string, current: PendingProcurement): PendingProcurement {
  const lower = text.toLowerCase();
  const next = { ...current };

  const qtyMatch =
    text.match(/\b(\d{2,5})\s*(units|jars|pieces|boxes|glass jars)?/i) ??
    text.match(/need\s+(\d{2,5})/i);
  if (qtyMatch) next.quantity = Number(qtyMatch[1]);

  const priceMatch =
    text.match(/max\s*\$?\s*([\d.]+)/i) ??
    text.match(/([\d.]+)\s*(¢|cents)\s*(each|per|\/)/i) ??
    text.match(/\$?\s*([\d.]+)\s*(?:usd|\$)?\s*(?:per|each|\/)\s*unit/i);
  if (priceMatch) {
    let p = Number(priceMatch[1]);
    if (lower.includes("cent")) p = p / 100;
    next.max_unit_price_usd = p;
  }

  for (const [key, corridor] of Object.entries(CORRIDOR_MAP)) {
    if (lower.includes(key) || lower.replace(/→|->| to /g, " ").includes(key)) {
      next.corridor = corridor;
      break;
    }
  }
  if (lower.includes("netherlands") && lower.includes("germany")) next.corridor = "DE-NL";
  if (lower.includes("france") && lower.includes("germany")) next.corridor = "DE-FR";

  const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) next.delivery_by = dateMatch[1];

  if (lower.includes("jar")) next.product = "Glass jar 250ml + lid";
  if (lower.includes("bottle")) next.product = "Glass bottle 250ml + cap";

  return next;
}

export function pendingToRules(p: PendingProcurement): AgentRules | null {
  if (!p.quantity || !p.max_unit_price_usd || !p.corridor) return null;
  return {
    quantity: p.quantity,
    max_unit_price_usd: p.max_unit_price_usd,
    corridor: p.corridor,
    delivery_by: p.delivery_by ?? defaultDeliveryDate(),
    product: p.product ?? "Glass jar 250ml + lid",
  };
}

export function defaultDeliveryDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

export function describePending(p: PendingProcurement): string {
  const parts: string[] = [];
  if (p.quantity) parts.push(`${p.quantity} units`);
  if (p.product) parts.push(p.product);
  if (p.max_unit_price_usd) parts.push(`max $${p.max_unit_price_usd}/unit`);
  if (p.corridor) parts.push(`corridor ${p.corridor}`);
  if (p.delivery_by) parts.push(`deliver by ${p.delivery_by}`);
  return parts.length ? parts.join(", ") : "incomplete";
}

export function missingFields(p: PendingProcurement): string[] {
  const missing: string[] = [];
  if (!p.quantity) missing.push("quantity (e.g. 500 units)");
  if (!p.max_unit_price_usd) missing.push("max unit price (e.g. $0.85)");
  if (!p.corridor) missing.push("trade corridor (e.g. Germany → Netherlands)");
  return missing;
}

export function wantsToConfirm(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return ["yes", "confirm", "go ahead", "proceed", "run", "start", "do it", "ok", "sure"].some(
    (w) => lower === w || lower.startsWith(`${w} `) || lower.includes(` ${w}`),
  );
}

export function wantsToCancel(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return ["no", "cancel", "stop", "abort"].includes(lower);
}
