"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const DISMISS_KEY = "trial_banner_dismissed_at";
const DISMISS_DAYS = 7;

export default function TrialBanner({
  jobsCompleted,
  jobsLimit,
  daysLeft,
}: {
  jobsCompleted: number;
  jobsLimit: number;
  daysLeft: number;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (raw) {
        const daysSince = (Date.now() - new Date(raw).getTime()) / 86400000;
        if (daysSince < DISMISS_DAYS) return;
      }
    } catch {
      // localStorage unavailable
    }
    setVisible(true);
  }, []);

  function dismiss(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    } catch { /* ignore */ }
    setVisible(false);
  }

  if (!visible) return null;

  const remaining = jobsLimit - jobsCompleted;
  const isNearLimit = remaining === 1;

  return (
    <Link
      href="/settings"
      className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl mb-4 border transition-colors active:opacity-80 ${
        isNearLimit
          ? "bg-orange-500/10 border-orange-500/30"
          : "bg-[#1A1A1A] border-[#2a2a2a]"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`shrink-0 w-2 h-2 rounded-full ${isNearLimit ? "bg-orange-500" : "bg-gray-600"}`} />
        <div className="min-w-0">
          {isNearLimit ? (
            <p className="text-orange-400 text-xs font-semibold leading-snug">
              One more qualifying job and you&apos;ll be asked to subscribe — make it count.
            </p>
          ) : (
            <p className="text-gray-400 text-xs font-semibold leading-snug">
              Trial — {jobsCompleted} of {jobsLimit} jobs completed
              {daysLeft > 0 ? ` · ${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining` : ""}
            </p>
          )}
        </div>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 text-gray-600 text-lg leading-none px-1 active:text-gray-400"
      >
        ×
      </button>
    </Link>
  );
}
