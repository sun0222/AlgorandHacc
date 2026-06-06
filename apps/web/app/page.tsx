"use client";

import { useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4021";
const LORA = "https://lora.algokit.io/transaction";

interface PaymentInfo {
  mode: string;
  demo_mode: boolean;
  asset: string;
  currency: string;
  quantoz_enabled: boolean;
}

interface WalletState {
  daily_spent_usd: number;
  total_spent_usd: number;
  max_daily_spend_usd: number;
  max_single_tx_usd: number;
  agent_address?: string;
}

interface JobStep {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
  detail?: string;
  tx_id?: string;
}

interface SpendRecord {
  endpoint: string;
  amount_usd: number;
  tx_id?: string;
  demo?: boolean;
  timestamp: string;
}

interface Job {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  steps: JobStep[];
  spends: SpendRecord[];
  result?: {
    supplier_name: string;
    unit_price_eur: number;
    freight_eur: number;
    total_eur: number;
    order_id: string;
    explanation: string;
    quantity: number;
  };
  error?: string;
  rules: {
    max_unit_price_eur: number;
    quantity: number;
    corridor: string;
    delivery_by: string;
  };
}

function stepSymbol(status: JobStep["status"]): string {
  if (status === "done") return "✓";
  if (status === "running") return "…";
  if (status === "error") return "✕";
  return "○";
}

export default function HomePage() {
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [payment, setPayment] = useState<PaymentInfo | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(false);

  const [quantity, setQuantity] = useState(500);
  const [maxUnit, setMaxUnit] = useState(0.85);
  const [corridor, setCorridor] = useState("DE-NL");
  const [deliveryBy, setDeliveryBy] = useState("2026-06-20");

  const loadMeta = useCallback(async () => {
    const [healthRes, walletRes] = await Promise.all([
      fetch(`${API}/agent/health`),
      fetch(`${API}/agent/wallet`),
    ]);
    const health: PaymentInfo = await healthRes.json();
    const w = await walletRes.json();
    setPayment(health);
    setWallet(w);
  }, []);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  const pollJob = useCallback((jobId: string) => {
    const interval = setInterval(async () => {
      const res = await fetch(`${API}/agent/jobs/${jobId}`);
      const data: Job = await res.json();
      setJob(data);
      if (data.status === "completed" || data.status === "failed") {
        clearInterval(interval);
        setLoading(false);
        void loadMeta();
      }
    }, 800);
    return () => clearInterval(interval);
  }, [loadMeta]);

  const runAgent = async () => {
    setLoading(true);
    setJob(null);
    const res = await fetch(`${API}/agent/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quantity,
        max_unit_price_eur: maxUnit,
        corridor,
        delivery_by: deliveryBy,
        product: "Glass jar 250ml + lid",
      }),
    });
    const created: Job = await res.json();
    setJob(created);
    pollJob(created.id);
  };

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.25rem" }}>
      <header style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700 }}>PackRoute Agent</h1>
          <span className={`badge ${payment?.demo_mode ? "demo" : "live"}`}>
            {payment?.demo_mode
              ? "Demo x402"
              : payment?.quantoz_enabled
                ? `Live ${payment.asset} (Quantoz)`
                : `Live TestNet ${payment?.asset ?? "USDC"}`}
          </span>
        </div>
        <p style={{ color: "var(--muted)", marginTop: "0.5rem", maxWidth: 640 }}>
          Autonomous EU F&amp;B packaging procurement — agent pays per API call via x402 on Algorand,
          then settles supplier checkout within your rules.
        </p>
      </header>

      <div className="grid-2">
        <section className="card">
          <h2 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>New sourcing job</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "1rem" }}>
            Demo: Amsterdam jam producer sourcing glass jars from Germany → Netherlands corridor.
          </p>

          <div className="field">
            <label>Quantity (units)</label>
            <input type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
          </div>
          <div className="field">
            <label>Max unit price (€)</label>
            <input type="number" step="0.01" value={maxUnit} onChange={(e) => setMaxUnit(Number(e.target.value))} />
          </div>
          <div className="field">
            <label>Trade corridor</label>
            <select value={corridor} onChange={(e) => setCorridor(e.target.value)}>
              <option value="DE-NL">Germany → Netherlands</option>
              <option value="DE-FR">Germany → France</option>
              <option value="DE-IT">Germany → Italy</option>
            </select>
          </div>
          <div className="field">
            <label>Deliver by</label>
            <input type="date" value={deliveryBy} onChange={(e) => setDeliveryBy(e.target.value)} />
          </div>

          <button className="btn-primary" disabled={loading} onClick={() => void runAgent()}>
            {loading ? "Agent running…" : "Run PackRoute Agent"}
          </button>
        </section>

        <section className="card">
          <h2 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>Agent wallet</h2>
          {wallet ? (
            <div style={{ fontSize: "0.9rem" }}>
              <p style={{ marginBottom: "0.5rem" }}>
                <span style={{ color: "var(--muted)" }}>Spent today:</span>{" "}
                <strong>${wallet.daily_spent_usd.toFixed(2)}</strong> / ${wallet.max_daily_spend_usd}
              </p>
              <p style={{ marginBottom: "0.5rem" }}>
                <span style={{ color: "var(--muted)" }}>Total spent:</span>{" "}
                <strong>${wallet.total_spent_usd.toFixed(2)}</strong>
              </p>
              {wallet.agent_address && (
                <p style={{ fontSize: "0.75rem", color: "var(--muted)", wordBreak: "break-all" }}>
                  Agent: {wallet.agent_address}
                </p>
              )}
            </div>
          ) : (
            <p style={{ color: "var(--muted)" }}>Loading…</p>
          )}
        </section>
      </div>

      {job && (
        <section className="card" style={{ marginTop: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "1.1rem" }}>Agent run</h2>
            <span className="badge">{job.status}</span>
          </div>

          {job.steps.map((step) => (
            <div key={step.id} className="step">
              <div className={`step-icon ${step.status}`}>{stepSymbol(step.status)}</div>
              <div>
                <div style={{ fontWeight: 600 }}>{step.label}</div>
                {step.detail && <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{step.detail}</div>}
                {step.tx_id && !step.tx_id.startsWith("DEMO") && (
                  <a href={`${LORA}/${step.tx_id}`} target="_blank" rel="noreferrer" style={{ fontSize: "0.8rem" }}>
                    View tx →
                  </a>
                )}
              </div>
            </div>
          ))}

          {job.result && (
            <div
              style={{
                marginTop: "1rem",
                padding: "1rem",
                background: "var(--accent-dim)",
                borderRadius: 8,
                border: "1px solid var(--accent)",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>Order confirmed: {job.result.order_id}</div>
              <p style={{ fontSize: "0.9rem" }}>{job.result.explanation}</p>
              <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: "0.5rem" }}>
                {job.result.supplier_name} · {job.result.quantity} units · €{job.result.total_eur.toFixed(2)} total
                (incl. €{job.result.freight_eur.toFixed(2)} freight)
              </p>
            </div>
          )}

          {job.error && (
            <p style={{ color: "var(--error)", marginTop: "1rem" }}>{job.error}</p>
          )}

          {job.spends.length > 0 && (
            <div style={{ marginTop: "1.25rem" }}>
              <h3 style={{ fontSize: "0.95rem", marginBottom: "0.5rem" }}>x402 payment log</h3>
              <table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: "var(--muted)", textAlign: "left" }}>
                    <th style={{ padding: "0.4rem 0" }}>Endpoint</th>
                    <th>Amount</th>
                    <th>Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {job.spends.map((s, i) => (
                    <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "0.4rem 0" }}>{s.endpoint}</td>
                      <td>${s.amount_usd.toFixed(2)}{s.demo ? " (demo)" : ""}</td>
                      <td>
                        {s.tx_id && !s.tx_id.startsWith("DEMO") ? (
                          <a href={`${LORA}/${s.tx_id}`} target="_blank" rel="noreferrer">
                            {s.tx_id.slice(0, 10)}…
                          </a>
                        ) : (
                          <span style={{ color: "var(--muted)" }}>{s.tx_id?.slice(0, 16) ?? "—"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <footer style={{ marginTop: "2rem", fontSize: "0.8rem", color: "var(--muted)" }}>
        PackRoute Agent · Algorand x402 Agentic Commerce Hackathon · Agentic Commerce track
      </footer>
    </main>
  );
}
