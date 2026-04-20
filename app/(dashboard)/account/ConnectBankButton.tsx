"use client";

import { useState } from "react";
import { createConnectOnboardingLink, createManagePayoutsLink } from "@/app/actions/stripe-connect";

interface Props {
  onboarded: boolean;
  hasAccountId: boolean;
}

export default function ConnectBankButton({ onboarded, hasAccountId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleConnect() {
    setLoading(true);
    setError("");
    try {
      const res = await createConnectOnboardingLink();
      if (res.error) {
        setError(res.error);
        return;
      }
      window.location.href = res.url!;
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleManage() {
    setLoading(true);
    setError("");
    try {
      const res = await createManagePayoutsLink();
      if (res.error) {
        setError(res.error);
        return;
      }
      window.open(res.url!, "_blank");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (onboarded) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-xl px-5 py-4">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <div>
            <p className="text-green-400 font-semibold text-sm">Bank Connected</p>
            <p className="text-green-600 text-xs">Payouts active — client payments route to your bank</p>
          </div>
        </div>
        <button
          onClick={handleManage}
          disabled={loading}
          className="w-full flex items-center justify-between bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4 active:scale-95 transition-transform disabled:opacity-50"
        >
          <div className="text-left">
            <p className="text-white font-semibold text-base">Manage Payouts</p>
            <p className="text-gray-500 text-xs mt-0.5">View balance, update bank, change settings</p>
          </div>
          {loading ? (
            <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          )}
        </button>
        {error && <p className="text-red-400 text-xs px-1">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {hasAccountId && (
        <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EAB308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <p className="text-yellow-400 text-xs font-semibold">Setup incomplete — tap below to finish connecting your bank</p>
        </div>
      )}
      <button
        onClick={handleConnect}
        disabled={loading}
        className="w-full flex items-center justify-between bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4 active:scale-95 transition-transform disabled:opacity-50"
      >
        <div className="text-left">
          <p className="text-white font-semibold text-base">
            {hasAccountId ? "Continue Bank Setup" : "Connect Your Bank"}
          </p>
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
      {error && <p className="text-red-400 text-xs px-1">{error}</p>}
    </div>
  );
}
