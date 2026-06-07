import { Router } from "express";
import { getJob } from "../store/jobs.js";
import { getSession } from "../store/sessions.js";
import { handleChatMessage, initSession } from "../agent/chat-agent.js";

const router = Router();

router.post("/sessions", (_req, res) => {
  const session = initSession();
  res.status(201).json({
    session_id: session.id,
    messages: session.messages,
    phase: session.phase,
    verified: session.verified,
  });
});

router.get("/sessions/:id", (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const payload: Record<string, unknown> = {
    session_id: session.id,
    messages: session.messages,
    phase: session.phase,
    verified: session.verified,
    email: session.email,
    pending: session.pending,
    active_job_id: session.active_job_id,
  };
  if (session.active_job_id) {
    const job = getJob(session.active_job_id);
    if (job) payload.job = job;
  }
  res.json(payload);
});

router.post("/sessions/:id/messages", async (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const text = String(req.body?.message ?? "").trim();
  if (!text) {
    res.status(400).json({ error: "message is required" });
    return;
  }
  try {
    const { session: updated, replies } = await handleChatMessage(session.id, text);
    const job = updated.active_job_id ? getJob(updated.active_job_id) : undefined;
    res.json({
      session_id: updated.id,
      messages: updated.messages,
      phase: updated.phase,
      verified: updated.verified,
      replies,
      job,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export { router as chatRouter };
