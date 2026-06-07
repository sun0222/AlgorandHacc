import { Router, Request, Response } from "express";
import { createJob, getJob, listJobs } from "../store/jobs.js";
import { getWalletState, resetWalletForDemo } from "../agent/wallet.js";
import { getAgentAddress, getPaymentInfo } from "../agent/x402-client.js";
import { runProcurementJob } from "../agent/orchestrator.js";
import type { AgentRules } from "../store/jobs.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    service: "packroute-agent",
    ...getPaymentInfo(),
    agent_address: getAgentAddress(),
  });
});

router.get("/wallet", (_req, res) => {
  res.json(getWalletState(getAgentAddress()));
});

router.post("/wallet/reset", (_req, res) => {
  resetWalletForDemo();
  res.json({ ok: true, wallet: getWalletState(getAgentAddress()) });
});

router.get("/jobs", (_req, res) => {
  res.json({ jobs: listJobs() });
});

router.get("/jobs/:id", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(job);
});

router.post("/jobs", (req, res) => {
  const body = req.body ?? {};
  const rules: AgentRules = {
    max_unit_price_usd: Number(body.max_unit_price_usd ?? 0.85),
    quantity: Number(body.quantity ?? 500),
    delivery_by: String(body.delivery_by ?? "2026-06-20"),
    corridor: String(body.corridor ?? "DE-NL"),
    product: String(body.product ?? "Glass jar 250ml + lid"),
  };

  const job = createJob(rules);
  void runProcurementJob(job.id, rules);
  res.status(202).json(job);
});

router.get("/jobs/:id/stream", (req, res) => {
  const jobId = req.params.id;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (): void => {
    const job = getJob(jobId);
    if (!job) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: "not found" })}\n\n`);
      res.end();
      return;
    }
    res.write(`data: ${JSON.stringify(job)}\n\n`);
    if (job.status === "completed" || job.status === "failed") {
      res.end();
    }
  };

  send();
  const interval = setInterval(send, 800);
  req.on("close", () => clearInterval(interval));
});

export { router as agentRouter };
