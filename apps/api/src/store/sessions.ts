export type ChatPhase =
  | "welcome"
  | "awaiting_email"
  | "awaiting_otp"
  | "verified"
  | "procuring";

export interface ChatMessage {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

export interface PendingProcurement {
  quantity?: number;
  max_unit_price_usd?: number;
  corridor?: string;
  delivery_by?: string;
  product?: string;
}

export interface ChatSession {
  id: string;
  phase: ChatPhase;
  email?: string;
  verified: boolean;
  messages: ChatMessage[];
  pending: PendingProcurement;
  active_job_id?: string;
  created_at: string;
  updated_at: string;
}

const sessions = new Map<string, ChatSession>();

export function createSession(): ChatSession {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const session: ChatSession = {
    id,
    phase: "welcome",
    verified: false,
    messages: [],
    pending: { product: "Glass jar 250ml + lid" },
    created_at: now,
    updated_at: now,
  };
  sessions.set(id, session);
  return session;
}

export function getSession(id: string): ChatSession | undefined {
  return sessions.get(id);
}

export function updateSession(id: string, patch: Partial<ChatSession>): ChatSession | undefined {
  const s = sessions.get(id);
  if (!s) return undefined;
  Object.assign(s, patch, { updated_at: new Date().toISOString() });
  return s;
}

export function addMessage(
  sessionId: string,
  role: ChatMessage["role"],
  content: string,
  meta?: Record<string, unknown>,
): ChatMessage | undefined {
  const s = sessions.get(sessionId);
  if (!s) return undefined;
  const msg: ChatMessage = {
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: new Date().toISOString(),
    meta,
  };
  s.messages.push(msg);
  s.updated_at = new Date().toISOString();
  return msg;
}
