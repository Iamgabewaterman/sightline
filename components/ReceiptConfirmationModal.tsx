"use client";

import { useState } from "react";
import { confirmReceiptItems } from "@/app/actions/receipts-vision";
import type { ExtractedReceiptItem, ReceiptExtractionResult } from "@/types";

interface Props {
  jobId: string;
  extraction: ReceiptExtractionResult;
  onDone: () => void;
  onCancel: () => void;
}

export default function ReceiptConfirmationModal({
  jobId,
  extraction,
  onDone,
  onCancel,
}: Props) {
  const [items, setItems] = useState<ExtractedReceiptItem[]>(extraction.items);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggle(index: number) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, checked: !item.checked } : item
      )
    );
  }

  async function handleConfirm() {
    setSaving(true);
    setError("");
    const result = await confirmReceiptItems(
      jobId,
      extraction.receipt_id,
      items,
      extraction.vendor
    );
    if (result.error) {
      setError(result.error);
      setSaving(false);
    } else {
      onDone();
    }
  }

  const checkedCount = items.filter((i) => i.checked).length;

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-[#2a2a2a] shrink-0">
        <div>
          <p className="text-white font-bold text-lg leading-tight">
            {extraction.vendor ?? "Receipt"}
          </p>
          {extraction.receipt_date && (
            <p className="text-gray-500 text-xs mt-0.5">{extraction.receipt_date}</p>
          )}
        </div>
        <button
          onClick={onCancel}
          className="text-gray-500 text-3xl leading-none active:scale-95 transition-transform"
          aria-label="Cancel"
        >
          ×
        </button>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {items.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">No line items found</p>
        ) : (
          items.map((item, i) => (
            <button
              key={i}
              onClick={() => toggle(i)}
              className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl border text-left transition-colors active:scale-95 transition-transform ${
                item.checked
                  ? "bg-[#1A1A1A] border-[#2a2a2a]"
                  : "bg-[#141414] border-[#1e1e1e] opacity-50"
              }`}
            >
              {/* Checkbox */}
              <div
                className={`w-6 h-6 rounded-md border-2 shrink-0 flex items-center justify-center transition-colors ${
                  item.checked
                    ? "bg-orange-500 border-orange-500"
                    : "border-[#444] bg-transparent"
                }`}
              >
                {item.checked && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2 6l3 3 5-5"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>

              {/* Item info */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm leading-tight">
                  {item.normalized_name}
                </p>
                {item.normalized_name !== item.raw_name && (
                  <p className="text-gray-600 text-xs mt-0.5 truncate">
                    {item.raw_name}
                  </p>
                )}
                {(item.qty !== null || item.unit) && (
                  <p className="text-gray-500 text-xs mt-0.5">
                    {item.qty !== null ? item.qty : ""}
                    {item.unit ? ` ${item.unit}` : ""}
                    {item.unit_price !== null ? ` @ $${item.unit_price.toFixed(2)}` : ""}
                  </p>
                )}
              </div>

              {/* Line total */}
              {item.line_total !== null && (
                <span className="text-orange-400 font-bold text-base shrink-0">
                  ${item.line_total.toFixed(2)}
                </span>
              )}
            </button>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-[#2a2a2a] shrink-0">
        {extraction.total !== null && (
          <div className="flex justify-between items-center mb-3">
            <span className="text-gray-400 text-sm">Receipt total</span>
            <span className="text-white font-bold text-lg">
              ${extraction.total.toFixed(2)}
            </span>
          </div>
        )}

        {error && (
          <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-xl px-4 py-3 mb-3">
            {error}
          </p>
        )}

        <button
          onClick={handleConfirm}
          disabled={saving}
          className="w-full bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
        >
          {saving
            ? "Saving..."
            : checkedCount === 0
            ? "Skip (no materials)"
            : `Add ${checkedCount} material${checkedCount !== 1 ? "s" : ""} to job`}
        </button>
      </div>
    </div>
  );
}
