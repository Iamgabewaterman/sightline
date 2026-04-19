"use server";

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export interface ContactPayload {
  name: string;
  company: string;
  phone: string;
  message: string;
}

export async function sendContactEmail(
  payload: ContactPayload
): Promise<{ error?: string }> {
  const { name, company, phone, message } = payload;

  if (!name.trim() || !message.trim()) {
    return { error: "Name and message are required." };
  }

  const { error } = await resend.emails.send({
    from: "Sightline Contact <onboarding@resend.dev>",
    to: "gabew595@gmail.com",
    subject: `Sightline inquiry from ${name.trim()}`,
    text: [
      `Name: ${name}`,
      `Company: ${company || "—"}`,
      `Phone: ${phone || "—"}`,
      "",
      `Message:`,
      message,
    ].join("\n"),
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
        <h2 style="color:#F97316;margin-bottom:4px;">New inquiry from ${name}</h2>
        <p style="color:#666;font-size:14px;margin-top:0;">via Sightline contact form</p>
        <table style="border-collapse:collapse;width:100%;margin-top:16px;">
          <tr><td style="padding:6px 0;color:#888;width:90px;">Name</td><td style="padding:6px 0;">${name}</td></tr>
          <tr><td style="padding:6px 0;color:#888;">Company</td><td style="padding:6px 0;">${company || "—"}</td></tr>
          <tr><td style="padding:6px 0;color:#888;">Phone</td><td style="padding:6px 0;">${phone || "—"}</td></tr>
        </table>
        <div style="margin-top:20px;padding:16px;background:#f5f5f5;border-radius:8px;">
          <p style="margin:0;white-space:pre-wrap;">${message.replace(/</g, "&lt;")}</p>
        </div>
      </div>
    `,
  });

  if (error) return { error: error.message };
  return {};
}

export async function sendIdeaEmail(
  idea: string
): Promise<{ error?: string }> {
  if (!idea.trim()) return { error: "Please share your idea first." };

  const { error } = await resend.emails.send({
    from: "Sightline Ideas <onboarding@resend.dev>",
    to: "gabew595@gmail.com",
    subject: "Sightline feature idea",
    text: idea.trim(),
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
        <h2 style="color:#F97316;margin-bottom:4px;">New feature idea</h2>
        <p style="color:#666;font-size:14px;margin-top:0;">via Sightline suggestions box</p>
        <div style="margin-top:20px;padding:16px;background:#f5f5f5;border-radius:8px;">
          <p style="margin:0;white-space:pre-wrap;">${idea.trim().replace(/</g, "&lt;")}</p>
        </div>
      </div>
    `,
  });

  if (error) return { error: error.message };
  return {};
}
