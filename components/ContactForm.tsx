"use client";

import { useState, useEffect } from "react";
import { sendContactEmail } from "@/app/actions/contact";

const EMAIL = "sightlinesupport@gmail.com";
const PHONE_DISPLAY = "971-469-7274";
const PHONE_SMS     = "sms:+19714697274";
const FALLBACK_MSG  = "Message could not be sent — please text us at 971-469-7274 or email sightlinesupport@gmail.com directly.";

interface Props {
  variant: "landing" | "settings";
}

export default function ContactForm({ variant }: Props) {
  const [name, setName]       = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone]     = useState("");
  const [message, setMessage] = useState("");
  const [method, setMethod]   = useState<"email" | "text" | "both">("email");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent]   = useState(false);
  const [error, setError] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const result = await sendContactEmail({ name, company, phone, message, method });
      if (result.error) {
        setError(result.error);
      } else {
        setSent(true);
      }
    } catch {
      setError(FALLBACK_MSG);
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    variant === "landing"
      ? "w-full bg-[#111] border border-[#2a2a2a] text-white rounded-xl px-4 py-4 text-base placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
      : "w-full bg-[#242424] border border-[#333333] text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500 transition-colors";

  const labelCls = "block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1.5";

  function chip(active: boolean) {
    return `flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors active:scale-95 text-center ${
      active ? "bg-orange-500 text-white border-orange-500" : "bg-[#1A1A1A] text-white border-[#2a2a2a]"
    }`;
  }

  if (sent) {
    const methodLabel = method === "both" ? "email and text notification" : method === "text" ? "text notification" : "email";
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-6 py-8 text-center">
        <p className="text-green-400 font-bold text-lg mb-1">Message sent!</p>
        <p className="text-gray-400 text-sm mb-3">We sent your message via {methodLabel} — we&rsquo;ll get back to you shortly.</p>
        <ContactLinks isMobile={isMobile} />
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
              type="text" required value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoCapitalize="words" autoCorrect="on"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Company Name</label>
            <input
              type="text" value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Your company (optional)"
              autoCapitalize="words" autoCorrect="on"
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Phone Number</label>
          <input
            type="tel" inputMode="tel" value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(503) 555-0100"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Message *</label>
          <textarea
            required value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell us about your business, your trade, or what you're looking for…"
            rows={4}
            className={`${inputCls} resize-none`}
          />
        </div>

        {/* Send method selector */}
        <div>
          <label className={labelCls}>How should we reply?</label>
          <div className="flex gap-2">
            {(["email", "text", "both"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMethod(m)} className={chip(method === m)}>
                {m === "email" ? "Email" : m === "text" ? "Text" : "Both"}
              </button>
            ))}
          </div>
          <p className="text-gray-600 text-xs mt-1.5">
            {method === "text" ? "We'll reply by text to the phone number you entered." : method === "both" ? "We'll reply by email and by text." : "We'll reply by email."}
          </p>
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

      {/* Direct contact */}
      <ContactLinks isMobile={isMobile} />
    </div>
  );
}

function ContactLinks({ isMobile }: { isMobile: boolean }) {
  const linkCls = "text-orange-400 underline underline-offset-2 decoration-orange-400/50 hover:text-orange-300 transition-colors";
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-gray-500 text-sm">
        Or reach us directly:{" "}
        <a href={`mailto:${EMAIL}`} className={linkCls}>{EMAIL}</a>
      </p>
      <p className="text-gray-500 text-sm">
        Text:{" "}
        {isMobile ? (
          <a href={PHONE_SMS} className={linkCls}>{PHONE_DISPLAY}</a>
        ) : (
          <span className="text-gray-400">{PHONE_DISPLAY}</span>
        )}
      </p>
    </div>
  );
}
