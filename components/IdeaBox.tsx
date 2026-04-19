"use client";

import { useState } from "react";
import { sendIdeaEmail } from "@/app/actions/contact";

export default function IdeaBox({ variant }: { variant: "settings" | "landing" }) {
  const [idea, setIdea] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const res = await sendIdeaEmail(idea);
    setSubmitting(false);
    if (res.error) { setError(res.error); return; }
    setSent(true);
  }

  const textareaCls =
    variant === "landing"
      ? "w-full bg-[#111] border border-[#2a2a2a] text-white rounded-xl px-4 py-4 text-base placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors resize-none"
      : "w-full bg-[#242424] border border-[#333333] text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500 transition-colors resize-none";

  if (sent) {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-6 py-8 text-center">
        <p className="text-green-400 font-bold text-lg mb-1">Idea received — thank you!</p>
        <p className="text-gray-400 text-sm">We read every message and build what contractors actually need.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-gray-400 text-sm leading-relaxed">
        We build Sightline from the field, not a boardroom. Tell us what would save you time — we read every message and build what contractors actually need.
      </p>
      <textarea
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        placeholder="What feature would save you the most time on the job?"
        rows={4}
        className={textareaCls}
      />
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
        {submitting ? "Sending…" : "Send Idea"}
      </button>
    </form>
  );
}
