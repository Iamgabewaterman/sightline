"use client";

import { useState, useEffect } from "react";

const DISMISSED_KEY = "sightline_getting_started_dismissed";

export default function GettingStartedHint({ jobId }: { jobId: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(DISMISSED_KEY);
      if (!dismissed) setVisible(true);
    } catch {
      // localStorage unavailable
    }
  }, [jobId]);

  function dismiss() {
    try { localStorage.setItem(DISMISSED_KEY, "1"); } catch { /* noop */ }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="bg-orange-500/8 border border-orange-500/25 rounded-2xl px-5 py-4 mb-4 flex items-start gap-3">
      <div className="w-8 h-8 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0 mt-0.5">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-orange-400 font-bold text-sm leading-snug">
          Add your first material or scan a receipt to start tracking this job.
        </p>
        <p className="text-gray-500 text-xs mt-1">
          Tap <span className="text-white font-semibold">Add Material</span> below to log lumber, shingles, or any supply cost.
        </p>
      </div>
      <button
        onClick={dismiss}
        className="shrink-0 text-gray-600 active:text-gray-400 min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label="Dismiss"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}
