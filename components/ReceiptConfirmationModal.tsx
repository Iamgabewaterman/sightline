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
  const [vendorEdit, setVendorEdit] = useState(extraction.vendor ?? "");
  const [totalEdit, setTotalEdit] = useState(
    extraction.total != null ? extraction.total.toString() : ""
  );
  const [dateEdit, setDateEdit] = useState(extraction.receipt_date ?? "");
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
    const editedAmount = totalEdit !== "" ? parseFloat(totalEdit) : null;
    const editedDate = dateEdit.trim() || null;
    const result = await confirmReceiptItems(
      jobId,
      extraction.receipt_id,
      items,
      vendorEdit.trim() || null,
      editedAmount,
      editedDate
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
        <p className="text-white font-bold text-lg leading-tight">Review Receipt</p>
        <button
          onClick={onCancel}
          className="text-gray-500 text-3xl leading-none active:scale-95 transition-transform"
          aria-label="Cancel"
        >
          ×
        </button>
      </div>

      {/* Editable receipt fields */}
      <div className="px-4 pt-4 pb-2 flex flex-col gap-3 border-b border-[#2a2a2a] shrink-0">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Vendor</label>
            <input
              type="text"
              value={vendorEdit}
              onChange={(e) => setVendorEdit(e.target.value)}
              placeholder="Store name"
              className="w-full bg-[#1A1A1A] border border-[#333] text-white rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-orange-500"
            />
          </div>
          <div className="w-28">
            <label className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Total $</label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={totalEdit}
              onChange={(e) => setTotalEdit(e.target.value)}
              placeholder="0.00"
              className="w-full bg-[#1A1A1A] border border-[#333] text-white rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>
        <div>
          <label className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Receipt Date</label>
          <input
            type="date"
            value={dateEdit}
            onChange={(e) => setDateEdit(e.target.value)}
            className="bg-[#1A1A1A] border border-[#333] text-white rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-orange-500 w-full"
          />
        </div>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {items.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">No line items found</p>
        ) : (
          <>
            <p className="text-gray-500 text-xs mb-1">Select items to add as job materials:</p>
            {items.map((item, i) => (
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
            ))}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-[#2a2a2a] shrink-0">
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
            ? "Confirm Receipt (no materials)"
            : `Add ${checkedCount} material${checkedCount !== 1 ? "s" : ""} to job`}
        </button>
      </div>
    </div>
  );
}
