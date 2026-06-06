"use client";

import { useState } from "react";
import { createInvoiceCheckoutSession, createMilestoneCheckoutSession } from "@/app/actions/stripe-invoice";

export default function PayButton({
  invoiceId,
  milestoneId,
  amount,
  returnUrl,
}: {
  invoiceId: string;
  milestoneId?: string;
  amount: number;
  returnUrl?: string;
}) {
  const [loading, setLoading] = useState<"ach" | "card" | null>(null);
  const [error, setError] = useState("");

  const cardFee = amount * 0.029 + 0.30;
  const achFee = 5;
  const savings = cardFee - achFee;

  async function handlePay(method: "ach" | "card") {
    setLoading(method);
    setError("");
    const result = milestoneId
      ? await createMilestoneCheckoutSession(milestoneId, method, returnUrl)
      : await createInvoiceCheckoutSession(invoiceId, method, returnUrl);
    if (result.url) {
      window.location.href = result.url;
    } else {
      setError(result.error ?? "Something went wrong");
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {savings > 1 && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl px-4 py-3 text-center">
          <p className="text-green-400 text-sm font-semibold">
            Save ${savings.toFixed(2)} with bank transfer vs card
          </p>
        </div>
      )}
      {error && (
        <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-xl px-4 py-3 text-center">
          {error}
        </p>
      )}
      <button
        onClick={() => handlePay("ach")}
        disabled={loading !== null}
        className="w-full bg-orange-500 text-white font-bold text-lg py-5 rounded-2xl active:scale-95 transition-transform disabled:opacity-50 flex flex-col items-center gap-0.5"
      >
        <span>{loading === "ach" ? "Redirecting…" : "Pay with Bank Transfer"}</span>
        <span className="text-orange-200 font-normal text-sm">$5.00 flat fee (ACH)</span>
      </button>
      <button
        onClick={() => handlePay("card")}
        disabled={loading !== null}
        className="w-full bg-[#242424] border border-[#333] text-white font-semibold text-base py-4 rounded-2xl active:scale-95 transition-transform disabled:opacity-50 flex flex-col items-center gap-0.5"
      >
        <span>{loading === "card" ? "Redirecting…" : "Pay with Card"}</span>
        <span className="text-gray-500 font-normal text-sm">${cardFee.toFixed(2)} card fee</span>
      </button>
    </div>
  );
}
