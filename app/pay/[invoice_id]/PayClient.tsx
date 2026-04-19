"use client";

import { useState } from "react";
import { createInvoiceCheckoutSession, createMilestoneCheckoutSession } from "@/app/actions/stripe-invoice";

export default function PayButton({
  invoiceId,
  milestoneId,
  label = "Pay Now",
}: {
  invoiceId: string;
  milestoneId?: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handlePay() {
    setLoading(true);
    setError("");
    const result = milestoneId
      ? await createMilestoneCheckoutSession(milestoneId)
      : await createInvoiceCheckoutSession(invoiceId);
    if (result.url) {
      window.location.href = result.url;
    } else {
      setError(result.error ?? "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-xl px-4 py-3 text-center">
          {error}
        </p>
      )}
      <button
        onClick={handlePay}
        disabled={loading}
        className="w-full bg-orange-500 text-white font-bold text-lg py-5 rounded-2xl active:scale-95 transition-transform disabled:opacity-50"
      >
        {loading ? "Redirecting to payment…" : label}
      </button>
    </div>
  );
}
