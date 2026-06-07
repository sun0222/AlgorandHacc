import nodemailer from "nodemailer";

export async function sendOtpEmail(email: string, code: string): Promise<void> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  const body = [
    "PackRoute Agent — Email Verification",
    "",
    `Your one-time verification code is: ${code}`,
    "",
    "This code expires in 10 minutes.",
    "No API keys. No subscriptions. Pay per request with USDC on Algorand via x402.",
    "",
    "— PackRoute Agent",
  ].join("\n");

  // Prefer Resend API if configured (existing behavior)
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "PackRoute <onboarding@resend.dev>",
        to: [email],
        subject: "Your PackRoute verification code",
        text: body,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Email send failed: ${err}`);
    }
    return;
  }

  // If SMTP credentials present, send via nodemailer (supports Gmail app-passwords)
  if (smtpHost && smtpUser && smtpPass) {
    try {
      const port = Number(process.env.SMTP_PORT ?? (smtpHost.includes("gmail") ? 465 : 587));
      let secure = (process.env.SMTP_SECURE ?? (smtpHost.includes("gmail") ? "true" : "false")) === "true";
      // Common setup: port 587 uses STARTTLS (not "secure"), so prefer requireTLS
      const transportOptions: any = {
        host: smtpHost,
        port,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      };

      if (port === 465) {
        transportOptions.secure = true;
      } else if (port === 587) {
        transportOptions.secure = false;
        transportOptions.requireTLS = true;
      } else {
        transportOptions.secure = secure;
      }

      const transporter = nodemailer.createTransport(transportOptions);

      await transporter.sendMail({
        from: process.env.EMAIL_FROM ?? `PackRoute <${smtpUser}>`,
        to: email,
        subject: "Your PackRoute verification code",
        text: body,
      });
      return;
    } catch (err) {
      console.error("[email] nodemailer send failed:", err);
      // fallthrough to console fallback so verification still works in demo mode
    }
  }

  // Fallback: log OTP to console for demo or if sending failed
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║  PackRoute OTP (demo / send fallback) ║");
  console.log("╚══════════════════════════════════════╝");
  console.log(`To:   ${email}`);
  console.log(`Code: ${code}`);
  console.log("Set RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS in .env for real email.\n");
}
