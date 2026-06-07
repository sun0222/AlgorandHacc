import { createJob, getJob } from "../store/jobs.js";
import {
  addMessage,
  createSession,
  getSession,
  updateSession,
  type ChatSession,
} from "../store/sessions.js";
import { generateOtp, verifyOtp } from "../store/otp.js";
import { sendOtpEmail } from "../services/email.js";
import { runProcurementJob } from "./orchestrator.js";
import {
  describePending,
  extractEmail,
  extractOtp,
  missingFields,
  parseProcurementIntent,
  pendingToRules,
  wantsToCancel,
  wantsToConfirm,
} from "./parse-intent.js";
import { getPaymentInfo } from "./x402-client.js";

const WELCOME = `Welcome to **PackRoute Agent** — autonomous EU F&B packaging procurement.

**How it works:**
1. Verify your email (OTP — no passwords, no API keys)
2. Tell me what you need in plain English
3. I pay per API call via **x402** on Algorand (USDC) — no subscriptions

What's your work email to get started?`;

function startJob(sessionId: string, rules: ReturnType<typeof pendingToRules> & object) {
  const job = createJob(rules);
  updateSession(sessionId, { active_job_id: job.id, phase: "procuring" });
  void runProcurementJob(job.id, rules).then(() => appendJobResult(sessionId, job.id));
  return job;
}

export function initSession(): ChatSession {
  const session = createSession();
  addMessage(session.id, "agent", WELCOME);
  updateSession(session.id, { phase: "awaiting_email" });
  return getSession(session.id)!;
}

export async function handleChatMessage(
  sessionId: string,
  userText: string,
): Promise<{ session: ChatSession; replies: string[] }> {
  const session = getSession(sessionId);
  if (!session) throw new Error("Session not found");

  addMessage(sessionId, "user", userText);
  const replies: string[] = [];

  if (session.phase === "procuring" && session.active_job_id) {
    const job = getJob(session.active_job_id);
    if (job?.status === "running" || job?.status === "queued") {
      const r = "Procurement is in progress — see live steps on the right. I'll message you when it's done.";
      addMessage(sessionId, "agent", r);
      replies.push(r);
      return { session: getSession(sessionId)!, replies };
    }
  }

  if (session.phase === "awaiting_email" || session.phase === "welcome") {
    const email = extractEmail(userText);
    if (!email) {
      const r =
        "Please send a valid email (e.g. `you@company.com`). Verification is required before procurement.";
      addMessage(sessionId, "agent", r);
      replies.push(r);
      return { session: getSession(sessionId)!, replies };
    }
    const code = generateOtp(email);
    await sendOtpEmail(email, code);
    updateSession(sessionId, { email, phase: "awaiting_otp" });
    const payment = getPaymentInfo();
    const r = `Sent a **6-digit code** to **${email}**. Enter it here to verify.
${payment.demo_mode ? "*(Demo: OTP printed in API terminal.)*" : ""}

After verification, procurement uses **x402** — pay-per-request in **${payment.asset}**, no subscriptions or API keys.`;
    addMessage(sessionId, "agent", r);
    replies.push(r);
    return { session: getSession(sessionId)!, replies };
  }

  if (session.phase === "awaiting_otp") {
    if (userText.toLowerCase().includes("resend") && session.email) {
      const code = generateOtp(session.email);
      await sendOtpEmail(session.email, code);
      const r = `New code sent to **${session.email}**.`;
      addMessage(sessionId, "agent", r);
      replies.push(r);
      return { session: getSession(sessionId)!, replies };
    }
    const otp = extractOtp(userText);
    if (!otp) {
      const r = "Enter the **6-digit OTP** from your email, or type **resend** for a new code.";
      addMessage(sessionId, "agent", r);
      replies.push(r);
      return { session: getSession(sessionId)!, replies };
    }
    const result = verifyOtp(session.email!, otp);
    if (!result.ok) {
      addMessage(sessionId, "agent", result.error!);
      replies.push(result.error!);
      return { session: getSession(sessionId)!, replies };
    }
    updateSession(sessionId, { verified: true, phase: "verified" });
    const r = `✓ **Verified** as **${session.email}**.

Describe your packaging need, e.g.:
*"500 glass jars, Germany to Netherlands, max $0.85/unit, deliver by 2026-06-20"*`;
    addMessage(sessionId, "agent", r);
    replies.push(r);
    return { session: getSession(sessionId)!, replies };
  }

  if (session.phase === "verified" || session.phase === "procuring") {
    if (wantsToCancel(userText)) {
      updateSession(sessionId, { phase: "verified", pending: { product: "Glass jar 250ml + lid" } });
      const r = "Cancelled. Describe a new procurement request when ready.";
      addMessage(sessionId, "agent", r);
      replies.push(r);
      return { session: getSession(sessionId)!, replies };
    }

    const pending = parseProcurementIntent(userText, session.pending);
    updateSession(sessionId, { pending, phase: "verified" });

    if (wantsToConfirm(userText)) {
      const rules = pendingToRules(pending);
      if (!rules) {
        const r = `Can't start yet — need: **${missingFields(pending).join("**, **")}**`;
        addMessage(sessionId, "agent", r);
        replies.push(r);
        return { session: getSession(sessionId)!, replies };
      }
      const job = startJob(sessionId, rules);
      const r = `🚀 **Procurement started** (\`${job.id.slice(0, 8)}…\`)

Autonomous x402 payments:
• Market analytics → supplier prices → freight → checkout

No subscriptions. No API keys. USDC on Algorand.`;
      addMessage(sessionId, "agent", r, { job_id: job.id });
      replies.push(r);
      return { session: getSession(sessionId)!, replies };
    }

    const missing = missingFields(pending);
    if (missing.length > 0) {
      const r = `Got it (${describePending(pending)}). Still need: **${missing.join("**, **")}**.`;
      addMessage(sessionId, "agent", r);
      replies.push(r);
      return { session: getSession(sessionId)!, replies };
    }

    const rules = pendingToRules(pending)!;
    const r = `Ready to procure:

• **${rules.quantity}** × ${rules.product}
• Max **$${rules.max_unit_price_usd}**/unit · **${rules.corridor}**
• Deliver by **${rules.delivery_by}**

I'll pay x402 micropayments from the agent wallet for each API call.

Reply **yes** to start.`;
    addMessage(sessionId, "agent", r, { pending: rules });
    replies.push(r);
    return { session: getSession(sessionId)!, replies };
  }

  return { session: getSession(sessionId)!, replies };
}

async function appendJobResult(sessionId: string, jobId: string): Promise<void> {
  const job = getJob(jobId);
  if (!job) return;

  if (job.status === "completed" && job.result) {
    const r = `✅ **Order ${job.result.order_id}** — ${job.result.supplier_name}
**$${job.result.total_usd.toFixed(2)}** total (${job.spends.length} x402 payments)

${job.result.explanation}`;
    addMessage(sessionId, "agent", r, { job_id: jobId });
    updateSession(sessionId, { phase: "verified", active_job_id: undefined });
  } else if (job.status === "failed") {
    addMessage(sessionId, "agent", `❌ Failed: ${job.error}\n\nTry again with updated requirements.`);
    updateSession(sessionId, { phase: "verified", active_job_id: undefined });
  }
}
