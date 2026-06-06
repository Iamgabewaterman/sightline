"use client";

import { useState } from "react";
import { createPortalCheckoutSession } from "@/app/actions/portal-payment";

interface PortalPayButtonProps {
  invoiceId: string;
  jobId: string;
  accessToken: string;
  milestoneId?: string;
  label: string;
}

export default function PortalPayButton({
  invoiceId,
  jobId,
  accessToken,
  milestoneId,
  label,
}: PortalPayButtonProps) {
  const [loading, setLoading] = useState<"ach" | "card" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pay(method: "ach" | "card") {
    setError(null);
    setLoading(method);
    try {
      const result = await createPortalCheckoutSession({
        invoiceId,
        jobId,
        accessToken,
        paymentMethod: method,
        milestoneId,
      });
      if (result.error) {
        setError(result.error);
        setLoading(null);
        return;
      }
      if (result.url) {
        window.location.href = result.url;
        // Keep loading state — browser navigates away
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(null);
    }
  }

  const busy = loading !== null;

  return (
    <div className="flex flex-col gap-2">
      {/* ACH bank transfer — primary, lowest fees */}
      <button
        onClick={() => pay("ach")}
        disabled={busy}
        className="w-full bg-orange-500 disabled:opacity-60 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-2"
      >
        {loading === "ach" ? (
          <>
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Opening...
          </>
        ) : (
          `${label} — Bank Transfer ($5 flat fee)`
        )}
      </button>

      {/* Card — secondary */}
      <button
        onClick={() => pay("card")}
        disabled={busy}
        className="w-full bg-[#242424] border border-[#2a2a2a] disabled:opacity-60 text-gray-300 font-semibold text-sm py-3.5 rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-2"
      >
        {loading === "card" ? (
          <>
            <svg className="animate-spin h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Opening...
          </>
        ) : (
          "Pay by card (2.9% + $0.30)"
        )}
      </button>

      {error && (
        <p className="text-red-400 text-sm text-center mt-1">{error}</p>
      )}
    </div>
  );
}
