"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4021";
const LORA = "https://lora.algokit.io/testnet/transaction";
const SESSION_KEY = "packroute_session_id";

interface ChatMessage {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
  timestamp: string;
}

interface JobStep {
  id: string;
  label: string;
  status: string;
  detail?: string;
  tx_id?: string;
}

interface Job {
  id: string;
  status: string;
  steps: JobStep[];
  spends: { endpoint: string; amount_usd: number; tx_id?: string; demo?: boolean }[];
  result?: {
    order_id: string;
    supplier_name: string;
    total_usd: number;
    explanation: string;
  };
  error?: string;
}

function renderMarkdownLite(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i}>{p.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

export default function HomePage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [phase, setPhase] = useState("welcome");
  const [verified, setVerified] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [payment, setPayment] = useState<{ demo_mode: boolean; asset: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollDown = () => {
    requestAnimationFrame(() => {
      try {
        bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      } catch (e) {
        // fallback: no-op
      }
    });
  };

  const idsEqual = (a: ChatMessage[], b: ChatMessage[]) => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i].id !== b[i].id) return false;
    return true;
  };

  const refreshSession = useCallback(async (id: string) => {
    const res = await fetch(`${API}/chat/sessions/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setMessages((prev) => {
      if (idsEqual(prev || [], data.messages || [])) return prev;
      return data.messages;
    });
    setPhase(data.phase);
    setVerified(data.verified);
    if (data.job) setJob(data.job);
  }, []);

  useEffect(() => {
    const health = fetch(`${API}/agent/health`).then((r) => r.json()).then(setPayment);
    void health;

    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) {
      setSessionId(existing);
      void refreshSession(existing);
      return;
    }

    fetch(`${API}/chat/sessions`, { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        localStorage.setItem(SESSION_KEY, data.session_id);
        setSessionId(data.session_id);
        setMessages(data.messages);
        setPhase(data.phase);
      });
  }, [refreshSession]);

  useEffect(() => {
    const prevCount = (bottomRef.current as any)?._prevCount ?? 0;
    if (messages.length > prevCount) {
      scrollDown();
    }
    if (bottomRef.current) (bottomRef.current as any)._prevCount = messages.length;
  }, [messages, job]);

  useEffect(() => {
    if (!sessionId) return;
    pollRef.current = setInterval(() => void refreshSession(sessionId), 1200);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [sessionId, refreshSession]);

  const sendMessage = async () => {
    if (!sessionId || !input.trim() || sending) return;
    setSending(true);
    const text = input.trim();
    setInput("");
    try {
      const res = await fetch(`${API}/chat/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      setMessages((prev) => {
        if (idsEqual(prev || [], data.messages || [])) return prev;
        return data.messages;
      });
      setPhase(data.phase);
      setVerified(data.verified);
      if (data.job) setJob(data.job);
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>PackRoute Agent</h1>
          <p className="subtitle">
            Chat to verify email · Agent procures via x402 (USDC on Algorand) — no subscriptions, no API keys
          </p>
        </div>
        <span className={`badge ${payment?.demo_mode ? "demo" : "live"}`}>
          {payment?.demo_mode ? "Demo x402" : `Live ${payment?.asset ?? "USDC"}`}
        </span>
      </header>

      <div className="app-grid">
        <section className="chat-panel card">
          <div className="chat-messages">
            {messages.map((m) => (
              <div key={m.id} className={`chat-row`}>
                <div className={`chat-avatar ${m.role}`}>{m.role === "user" ? "Y" : "P"}</div>
                <div className={`chat-bubble chat-${m.role}`}>
                  <div className="chat-role">{m.role === "user" ? "You" : "PackRoute Agent"}</div>
                  <div className="chat-text">{renderMarkdownLite(m.content)}</div>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {!verified && phase === "awaiting_email" && (
            <div className="quick-chips">
              <button type="button" onClick={() => setInput("demo@jamworks.nl")}>
                demo@jamworks.nl
              </button>
            </div>
          )}

          {verified && !job?.result && (
            <div className="quick-chips">
              <button
                type="button"
                onClick={() =>
                  setInput(
                    "I need 500 glass jars from Germany to Netherlands, max $0.85 per unit, deliver by 2026-06-20",
                  )
                }
              >
                Example order
              </button>
              <button type="button" onClick={() => setInput("yes")}>
                yes
              </button>
            </div>
          )}

          <form
            className="chat-input-row"
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage();
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                phase === "awaiting_email"
                  ? "Enter your email…"
                  : phase === "awaiting_otp"
                    ? "Enter 6-digit OTP…"
                    : "Describe packaging need or reply yes…"
              }
              disabled={sending}
            />
            <button type="submit" className="btn-send" disabled={sending || !input.trim()}>
              {sending ? "…" : "Send"}
            </button>
          </form>
        </section>

        <aside className="side-panel">
          <section className="card">
            <h2>Session</h2>
            <p className="meta-row">
              <span>Status</span>
              <strong>{verified ? "Verified ✓" : (phase?.replace(/_/g, " ") ?? "loading...")}</strong>
            </p>
            <p className="meta-row">
              <span>x402</span>
              <strong>Pay-per-request</strong>
            </p>
          </section>

          {job && (
            <section className="card job-card">
              <div className="job-header">
                <h2>Live procurement</h2>
                <span className={`badge ${job.status}`}>{job.status}</span>
              </div>
              {job.steps.map((step) => (
                <div key={step.id} className="step">
                  <div className={`step-icon ${step.status}`}>
                    {step.status === "done" ? "✓" : step.status === "running" ? "…" : step.status === "error" ? "✗" : "○"}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{step.label}</div>
                    {step.detail && (
                      <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{step.detail}</div>
                    )}
                    {step.tx_id && !step.tx_id.startsWith("DEMO") && (
                      <a href={`${LORA}/${step.tx_id}`} target="_blank" rel="noreferrer">
                        View on Lora Testnet
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {job.spends.length > 0 && (
                <div className="spend-log">
                  <h3>x402 payments</h3>
                  {job.spends.map((s, i) => (
                    <div key={i} className="spend-item">
                      <div className="spend-row">
                        <span>{s.endpoint.split("?")[0]}</span>
                        <span>${s.amount_usd.toFixed(4)}{s.demo ? " (demo)" : ""}</span>
                      </div>
                      {s.tx_id && !s.tx_id.startsWith("DEMO") && (
                        <a
                          href={`${LORA}/${s.tx_id}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: "0.72rem", paddingLeft: "0.25rem" }}
                        >
                          Lora Testnet tx
                        </a>
                      )}
                    </div>
                  ))}
                  <div className="spend-row" style={{ marginTop: "0.5rem", fontWeight: 600, color: "var(--text)" }}>
                    <span>Total</span>
                    <span>${job.spends.reduce((s, p) => s + p.amount_usd, 0).toFixed(4)}</span>
                  </div>
                </div>
              )}
              {job.result && (
                <div style={{ marginTop: "1rem" }}>
                  <div className="spend-row" style={{ color: "var(--text)", fontWeight: 600 }}>
                    <span>Order {job.result.order_id}</span>
                    <span>${job.result.total_usd.toFixed(2)}</span>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                    {job.result.supplier_name}
                  </div>
                </div>
              )}
              {(job.status === "completed" || job.status === "failed") && (
                <a
                  href={`${API}/agent/jobs/${job.id}/receipt`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-receipt"
                >
                  Download PDF Receipt
                </a>
              )}
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
