"use client";

import { useState } from "react";
import { sendContactEmail } from "@/app/actions/contact";

const PHONE = "(503) 550-1603";
const EMAIL = "gabew595@gmail.com";

interface Props {
  /** "landing" = full dark marketing card; "settings" = inline settings style */
  variant: "landing" | "settings";
}

export default function ContactForm({ variant }: Props) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const result = await sendContactEmail({ name, company, phone, message });
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSent(true);
    }
  }

  const inputCls =
    variant === "landing"
      ? "w-full bg-[#111] border border-[#2a2a2a] text-white rounded-xl px-4 py-4 text-base placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
      : "w-full bg-[#242424] border border-[#333333] text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500 transition-colors";

  const labelCls =
    variant === "landing"
      ? "block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1.5"
      : "block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1.5";

  if (sent) {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-6 py-8 text-center">
        <p className="text-green-400 font-bold text-lg mb-1">Message sent!</p>
        <p className="text-gray-400 text-sm">We'll get back to you shortly.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoCapitalize="words"
              autoCorrect="on"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Company Name</label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Your company (optional)"
              autoCapitalize="words"
              autoCorrect="on"
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Phone Number</label>
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(503) 555-0100"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Message *</label>
          <textarea
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell us about your business, your trade, or what you're looking for…"
            rows={4}
            className={`${inputCls} resize-none`}
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-orange-500 text-white font-bold text-base py-4 rounded-xl hover:bg-orange-400 transition-colors active:scale-95 disabled:opacity-50"
        >
          {submitting ? "Sending…" : "Send Message"}
        </button>
      </form>

      {/* Direct contact details */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-6">
        <a
          href={`tel:${PHONE.replace(/\D/g, "")}`}
          className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors"
        >
          <span className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.68A2 2 0 012 0h3a2 2 0 012 1.72c.13 1 .39 1.97.74 2.91a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.17-1.17a2 2 0 012.11-.45c.94.35 1.91.61 2.91.74A2 2 0 0122 14.92v2z"/>
            </svg>
          </span>
          <span className="text-sm font-semibold">{PHONE}</span>
        </a>

        <a
          href={`mailto:${EMAIL}`}
          className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors"
        >
          <span className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </span>
          <span className="text-sm font-semibold">{EMAIL}</span>
        </a>
      </div>
    </div>
  );
}
