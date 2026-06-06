"use client";

import { useState, useMemo } from "react";
import { confirmReceiptItems } from "@/app/actions/receipts-vision";
import { findBestMaterialMatch, MaterialMatch } from "@/lib/fuzzy-match";
import type { ExtractedReceiptItem, ReceiptExtractionResult, Material } from "@/types";

interface Props {
  jobId: string;
  extraction: ReceiptExtractionResult;
  existingMaterials: Material[];
  onDone: (addedTotal?: number) => void;
  onCancel: () => void;
  onRetry?: () => void;
}

export default function ReceiptConfirmationModal({
  jobId,
  extraction,
  existingMaterials,
  onDone,
  onCancel,
  onRetry,
}: Props) {
  const [items, setItems] = useState<ExtractedReceiptItem[]>(extraction.items);
  const [vendorEdit, setVendorEdit] = useState(extraction.vendor ?? "");
  const [totalEdit, setTotalEdit] = useState(
    extraction.total != null ? extraction.total.toString() : ""
  );
  const [dateEdit, setDateEdit] = useState(extraction.receipt_date ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [jobSuggestionDismissed, setJobSuggestionDismissed] = useState(false);

  const [matchChoices, setMatchChoices] = useState<Record<number, "link" | "add_new">>({});

  const matches = useMemo<Array<MaterialMatch | null>>(() => {
    return items.map((item) =>
      item.is_discount
        ? null
        : findBestMaterialMatch(item.normalized_name, item.unit_price, existingMaterials)
    );
  }, [items, existingMaterials]);

  function toggle(index: number) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, checked: !item.checked } : item))
    );
  }

  function updateItemName(index: number, name: string) {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, normalized_name: name, raw_name: name } : item));
  }

  function updateItemPrice(index: number, price: string) {
    const val = parseFloat(price);
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, line_total: isNaN(val) ? null : val } : item));
  }

  function setChoice(index: number, choice: "link" | "add_new") {
    setMatchChoices((prev) => ({ ...prev, [index]: choice }));
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, checked: true } : item))
    );
  }

  async function handleConfirm() {
    setSaving(true);
    setError("");

    const finalItems: ExtractedReceiptItem[] = items.map((item, i) => {
      const match = matches[i];
      if (match) {
        const choice = matchChoices[i] ?? "link";
        if (choice === "link") {
          return { ...item, checked: true, linked_material_id: match.material.id };
        }
        return { ...item, linked_material_id: null };
      }
      return { ...item, linked_material_id: null };
    });

    const editedAmount = totalEdit !== "" ? parseFloat(totalEdit) : null;
    const editedDate = dateEdit.trim() || null;
    const result = await confirmReceiptItems(
      jobId,
      extraction.receipt_id,
      finalItems,
      vendorEdit.trim() || null,
      editedAmount,
      editedDate
    );
    if (result.error) {
      setError(result.error);
      setSaving(false);
    } else {
      const addedTotal = editedAmount ?? extraction.total ?? 0;
      onDone(addedTotal);
    }
  }

  const regularItems = items.filter((i) => !i.is_discount);
  const discountItems = items.filter((i) => i.is_discount);

  const linkedCount = regularItems.filter((item, i) => {
    const idx = items.indexOf(item);
    return matches[idx] && (matchChoices[idx] ?? "link") === "link";
  }).length;

  const addCount = regularItems.filter((item, i) => {
    const idx = items.indexOf(item);
    if (!item.checked) return false;
    if (matches[idx]) return (matchChoices[idx] ?? "link") === "add_new";
    return true;
  }).length;

  const actionCount = linkedCount + addCount;

  const confidence = extraction.confidence;
  const showConfidenceBanner = confidence === "medium" || confidence === "low";
  const showJobSuggestion = extraction.suggested_job && !jobSuggestionDismissed;

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

      {/* Confidence banner */}
      {showConfidenceBanner && (
        <div className="px-4 pt-3 shrink-0">
          <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-3 py-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EAB308" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p className="text-yellow-400 text-xs leading-snug">
              {confidence === "low"
                ? "Low confidence — photo was hard to read. Review each item carefully and correct any errors."
                : "Medium confidence — some lines may be inaccurate. Verify totals and item names."}
            </p>
          </div>
        </div>
      )}

      {/* Pro Xtra job suggestion */}
      {showJobSuggestion && (
        <div className="px-4 pt-3 shrink-0">
          <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 rounded-xl px-3 py-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" className="shrink-0">
              <path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
            </svg>
            <p className="text-orange-300 text-xs flex-1 leading-snug">
              Pro Xtra job: <span className="text-white font-semibold">{extraction.job_name}</span>
              {" → "}matches <span className="text-orange-400 font-semibold">{extraction.suggested_job}</span>
            </p>
            <button
              onClick={() => setJobSuggestionDismissed(true)}
              className="text-gray-600 text-lg leading-none shrink-0"
              aria-label="Dismiss"
            >×</button>
          </div>
        </div>
      )}

      {/* Editable receipt fields */}
      <div className="px-4 pt-3 pb-3 flex flex-col gap-3 border-b border-[#2a2a2a] shrink-0">
        {/* Total — large display or manual entry */}
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Vendor</label>
            <input
              type="text"
              value={vendorEdit}
              onChange={(e) => setVendorEdit(e.target.value)}
              placeholder="Store name"
              className="w-full bg-[#1A1A1A] border border-[#333] text-white rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-orange-500"
            />
            {extraction.store_location && (
              <p className="text-gray-600 text-xs mt-1 px-1">{extraction.store_location}</p>
            )}
          </div>
          <div className="w-32 shrink-0">
            <label className="text-gray-500 text-xs uppercase tracking-wider block mb-1">
              {extraction.total == null ? "Enter Total $" : "Total $"}
            </label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={totalEdit}
              onChange={(e) => setTotalEdit(e.target.value)}
              placeholder="0.00"
              className={`w-full bg-[#1A1A1A] border rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-orange-500 ${
                extraction.total == null
                  ? "border-yellow-500/50 text-yellow-300 font-bold"
                  : "border-[#333] text-white font-bold text-base"
              }`}
            />
          </div>
        </div>

        {extraction.total != null && (
          <div className="flex items-center justify-between bg-[#111] rounded-xl px-4 py-2.5">
            <div className="flex gap-4">
              {extraction.subtotal != null && (
                <span className="text-gray-500 text-xs">Subtotal <span className="text-gray-300">${extraction.subtotal.toFixed(2)}</span></span>
              )}
              {extraction.tax != null && (
                <span className="text-gray-500 text-xs">Tax <span className="text-gray-300">${extraction.tax.toFixed(2)}</span></span>
              )}
            </div>
            <span className="text-orange-500 font-bold text-xl">${extraction.total.toFixed(2)}</span>
          </div>
        )}

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
        {regularItems.length === 0 && discountItems.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">No line items found</p>
        ) : (
          <>
            {regularItems.length > 0 && (
              <p className="text-gray-500 text-xs mb-1">Select items to add as job materials:</p>
            )}
            {items.map((item, i) => {
              if (item.is_discount) return null; // rendered below

              const match = matches[i];
              const choice = matchChoices[i] ?? "link";

              if (match) {
                return (
                  <div key={i} className="bg-[#1A1A1A] border border-orange-500/30 rounded-xl px-4 py-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm leading-tight">{item.normalized_name}</p>
                        {item.unit_price !== null && (
                          <p className="text-gray-500 text-xs mt-0.5">
                            {item.qty != null ? `${item.qty} ` : ""}@ ${item.unit_price.toFixed(2)}
                          </p>
                        )}
                        {item.category && (
                          <span className="inline-block mt-1 text-[10px] font-semibold text-gray-500 bg-[#2a2a2a] rounded px-1.5 py-0.5">{item.category}</span>
                        )}
                      </div>
                      {item.line_total !== null && (
                        <span className="text-orange-400 font-bold text-sm shrink-0 ml-2">${item.line_total.toFixed(2)}</span>
                      )}
                    </div>
                    <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2 mb-3">
                      <p className="text-orange-300 text-xs font-semibold mb-0.5">Matches material already logged:</p>
                      <p className="text-white text-xs">
                        {match.material.name}
                        {match.material.unit_cost != null ? ` — $${match.material.unit_cost.toFixed(2)}/${match.material.unit}` : ""}
                        {" · "}<span className="text-gray-400">×{match.material.quantity_ordered} {match.material.unit}</span>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setChoice(i, "link")}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-colors active:scale-95 ${
                          choice === "link" ? "bg-green-600/20 border-green-500/40 text-green-400" : "bg-[#242424] border-[#333] text-gray-500"
                        }`}>
                        Link — no new entry
                      </button>
                      <button type="button" onClick={() => setChoice(i, "add_new")}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-colors active:scale-95 ${
                          choice === "add_new" ? "bg-orange-500/20 border-orange-500/40 text-orange-400" : "bg-[#242424] border-[#333] text-gray-500"
                        }`}>
                        Add as new purchase
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={i}
                  className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border ${
                    item.checked ? "bg-[#1A1A1A] border-[#2a2a2a]" : "bg-[#141414] border-[#1e1e1e] opacity-60"
                  }`}>
                  <button
                    onClick={() => toggle(i)}
                    className={`w-6 h-6 rounded-md border-2 shrink-0 flex items-center justify-center transition-colors mt-2 ${
                      item.checked ? "bg-orange-500 border-orange-500" : "border-[#444] bg-transparent"
                    }`}
                  >
                    {item.checked && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <input
                      type="text"
                      value={item.normalized_name}
                      onChange={(e) => updateItemName(i, e.target.value)}
                      className="w-full bg-[#242424] border border-[#333] text-white text-sm rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-orange-500"
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.qty !== null && (
                        <span className="text-gray-500 text-xs">{item.qty}{item.unit ? ` ${item.unit}` : ""}{item.unit_price !== null ? ` @ $${item.unit_price.toFixed(2)}` : ""}</span>
                      )}
                      {item.category && (
                        <span className="text-[10px] font-semibold text-gray-500 bg-[#2a2a2a] rounded px-1.5 py-0.5">{item.category}</span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-1 mt-1">
                    <span className="text-gray-500 text-xs">$</span>
                    <input
                      type="number"
                      value={item.line_total ?? ""}
                      onChange={(e) => updateItemPrice(i, e.target.value)}
                      className="w-20 bg-[#242424] border border-[#333] text-orange-400 font-bold text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:border-orange-500"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              );
            })}

            {/* Discount items — muted section */}
            {discountItems.length > 0 && (
              <div className="mt-2">
                <p className="text-gray-600 text-xs mb-1.5 uppercase tracking-wider">Savings / Discounts</p>
                {discountItems.map((item, di) => (
                  <div key={`disc-${di}`} className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#111] border border-[#1e1e1e] mb-1.5">
                    <p className="text-gray-600 text-sm flex-1 min-w-0 truncate">{item.normalized_name || item.raw_name}</p>
                    {item.line_total !== null && (
                      <span className="text-green-600 font-semibold text-sm shrink-0 ml-2">-${Math.abs(item.line_total).toFixed(2)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-[#2a2a2a] shrink-0">
        {linkedCount > 0 && (
          <p className="text-green-400 text-xs mb-2 text-center">
            {linkedCount} item{linkedCount !== 1 ? "s" : ""} will be linked to existing material{linkedCount !== 1 ? "s" : ""} — no duplicate cost
          </p>
        )}
        {error && (
          <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-xl px-4 py-3 mb-3">{error}</p>
        )}
        <button
          onClick={handleConfirm}
          disabled={saving}
          className="w-full bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50 mb-2"
        >
          {saving
            ? "Saving..."
            : actionCount === 0
            ? "Confirm Receipt (no materials)"
            : `Confirm — ${addCount > 0 ? `add ${addCount}` : ""}${addCount > 0 && linkedCount > 0 ? ", " : ""}${linkedCount > 0 ? `link ${linkedCount}` : ""}`}
        </button>
        {onRetry && (
          <button
            onClick={onRetry}
            className="w-full bg-transparent border border-[#2a2a2a] text-gray-400 font-semibold text-base py-3.5 rounded-xl active:scale-95 transition-transform"
          >
            Retry with better photo
          </button>
        )}
      </div>
    </div>
  );
}
