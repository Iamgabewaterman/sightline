"use client";

import { useState } from "react";
import { createConnectOnboardingLink } from "@/app/actions/stripe-connect";

export default function ConnectBankButton({ onboarded }: { onboarded: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setLoading(true);
    setError("");
    const res = await createConnectOnboardingLink();
    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }
    window.location.href = res.url!;
  }

  if (onboarded) {
    return (
      <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-xl px-5 py-4">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <div>
          <p className="text-green-400 font-semibold text-sm">Bank Connected</p>
          <p className="text-green-600 text-xs">Client payments route directly to your bank</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="w-full flex items-center justify-between bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4 active:scale-95 transition-transform disabled:opacity-50"
      >
        <div className="text-left">
          <p className="text-white font-semibold text-base">Connect Your Bank</p>
          <p className="text-gray-500 text-xs mt-0.5">Required to receive client payments</p>
        </div>
        {loading ? (
          <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        )}
      </button>
      {error && <p className="text-red-400 text-xs mt-2 px-1">{error}</p>}
    </div>
  );
}
