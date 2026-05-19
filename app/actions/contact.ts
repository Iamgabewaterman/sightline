"use server";

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// sightline.one is not yet verified in Resend — use shared dev domain with reply_to
const FROM     = "Sightline <onboarding@resend.dev>";
const REPLY_TO = "sightlinesupport@gmail.com";
const TO       = "sightlinesupport@gmail.com";
const FALLBACK = "Message could not be sent — please text us at 971-469-7274 or email sightlinesupport@gmail.com directly.";

interface SendParams {
  from: string; replyTo: string; to: string;
  subject: string; text: string; html: string;
}

async function sendWithTimeout(params: SendParams): Promise<{ error?: string }> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(FALLBACK)), 10_000)
  );
  try {
    const { error } = await Promise.race([resend.emails.send(params), timeout]);
    if (error) return { error: error.message };
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : FALLBACK };
  }
}

export interface ContactPayload {
  name: string;
  company: string;
  phone: string;
  message: string;
  method?: "email" | "text" | "both";
}

export async function sendContactEmail(
  payload: ContactPayload
): Promise<{ error?: string }> {
  const { name, company, phone, message, method = "email" } = payload;

  if (!name.trim() || !message.trim()) {
    return { error: "Name and message are required." };
  }

  function build(subject: string, replyNote: string): SendParams {
    return {
      from: FROM, replyTo: REPLY_TO, to: TO, subject,
      text: [
        `Name: ${name}`,
        `Company: ${company || "—"}`,
        `Phone: ${phone || "—"}`,
        "",
        "Message:",
        message,
        "",
        "---",
        replyNote,
      ].join("\n"),
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
          <h2 style="color:#F97316;margin-bottom:4px;">${subject}</h2>
          <p style="color:#666;font-size:14px;margin-top:0;">via Sightline contact form</p>
          <table style="border-collapse:collapse;width:100%;margin-top:16px;">
            <tr><td style="padding:6px 0;color:#888;width:90px;">Name</td><td style="padding:6px 0;">${name}</td></tr>
            <tr><td style="padding:6px 0;color:#888;">Company</td><td style="padding:6px 0;">${company || "—"}</td></tr>
            <tr><td style="padding:6px 0;color:#888;">Phone</td><td style="padding:6px 0;">${phone || "—"}</td></tr>
          </table>
          <div style="margin-top:20px;padding:16px;background:#f5f5f5;border-radius:8px;">
            <p style="margin:0;white-space:pre-wrap;">${message.replace(/</g, "&lt;")}</p>
          </div>
          <p style="margin-top:24px;color:#999;font-size:12px;">${replyNote}</p>
        </div>
      `,
    };
  }

  if (method === "both") {
    const [r1, r2] = await Promise.all([
      sendWithTimeout(build(`Sightline inquiry from ${name.trim()}`, "Reply by email or text 971-469-7274")),
      sendWithTimeout(build(`New text inquiry from ${name.trim()}`, `Reply by TEXT to: ${phone || "number not provided"}`)),
    ]);
    if (r1.error && r2.error) return { error: r1.error };
    return {};
  }

  const isText = method === "text";
  return sendWithTimeout(build(
    isText ? `New text inquiry from ${name.trim()}` : `Sightline inquiry from ${name.trim()}`,
    isText
      ? `Reply by TEXT to: ${phone || "number not provided"}`
      : "Reply by email or text 971-469-7274"
  ));
}

export async function sendIdeaEmail(
  idea: string
): Promise<{ error?: string }> {
  if (!idea.trim()) return { error: "Please share your idea first." };

  return sendWithTimeout({
    from: FROM, replyTo: REPLY_TO, to: TO,
    subject: "Sightline feature idea",
    text: [idea.trim(), "", "---", "Reply by email or text 971-469-7274"].join("\n"),
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
        <h2 style="color:#F97316;margin-bottom:4px;">New feature idea</h2>
        <p style="color:#666;font-size:14px;margin-top:0;">via Sightline suggestions box</p>
        <div style="margin-top:20px;padding:16px;background:#f5f5f5;border-radius:8px;">
          <p style="margin:0;white-space:pre-wrap;">${idea.trim().replace(/</g, "&lt;")}</p>
        </div>
        <p style="margin-top:24px;color:#999;font-size:12px;">Reply by email or text 971-469-7274</p>
      </div>
    `,
  });
}
