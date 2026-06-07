interface OtpRecord {
  email: string;
  code: string;
  expires_at: number;
  attempts: number;
}

const otps = new Map<string, OtpRecord>();
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function generateOtp(email: string): string {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  otps.set(email.toLowerCase(), {
    email: email.toLowerCase(),
    code,
    expires_at: Date.now() + OTP_TTL_MS,
    attempts: 0,
  });
  return code;
}

export function verifyOtp(email: string, code: string): { ok: boolean; error?: string } {
  const record = otps.get(email.toLowerCase());
  if (!record) return { ok: false, error: "No OTP found. Please request a new code." };
  if (Date.now() > record.expires_at) {
    otps.delete(email.toLowerCase());
    return { ok: false, error: "OTP expired. Please request a new code." };
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    otps.delete(email.toLowerCase());
    return { ok: false, error: "Too many attempts. Please request a new code." };
  }
  record.attempts += 1;
  if (record.code !== code.trim()) {
    return { ok: false, error: `Invalid code. ${MAX_ATTEMPTS - record.attempts} attempts left.` };
  }
  otps.delete(email.toLowerCase());
  return { ok: true };
}
