"use client";

import { useState, useMemo } from "react";
import { confirmReceiptItems } from "@/app/actions/receipts-vision";
import { findBestMaterialMatch, MaterialMatch } from "@/lib/fuzzy-match";
import type { ExtractedReceiptItem, ReceiptExtractionResult, Material } from "@/types";

interface Props {
  jobId: string;
  extraction: ReceiptExtractionResult;
  existingMaterials: Material[];
  onDone: () => void;
  onCancel: () => void;
}

export default function ReceiptConfirmationModal({
  jobId,
  extraction,
  existingMaterials,
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

  // "link" = attach to existing material (no new row); "add_new" = insert new
  const [matchChoices, setMatchChoices] = useState<Record<number, "link" | "add_new">>({});

  // Compute best match for each receipt item against existing unlinked materials
  const matches = useMemo<Array<MaterialMatch | null>>(() => {
    return items.map((item) =>
      findBestMaterialMatch(item.normalized_name, item.unit_price, existingMaterials)
    );
  }, [items, existingMaterials]);

  function toggle(index: number) {
    // Only toggle items that have no match (or user chose "add_new")
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, checked: !item.checked } : item))
    );
  }

  function setChoice(index: number, choice: "link" | "add_new") {
    setMatchChoices((prev) => ({ ...prev, [index]: choice }));
    // Ensure item is checked when either choice is made
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, checked: true } : item))
    );
  }

  async function handleConfirm() {
    setSaving(true);
    setError("");

    // Apply match choices to items before sending
    const finalItems: ExtractedReceiptItem[] = items.map((item, i) => {
      const match = matches[i];
      if (match) {
        const choice = matchChoices[i] ?? "link"; // default: link (prevents double-count)
        if (choice === "link") {
          return { ...item, checked: true, linked_material_id: match.material.id };
        }
        // "add_new" — insert new material, no link
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
      onDone();
    }
  }

  // Count what will be processed
  const linkedCount = items.filter((_, i) => matches[i] && (matchChoices[i] ?? "link") === "link").length;
  const addCount = items.filter((item, i) => {
    if (!item.checked) return false;
    if (matches[i]) return (matchChoices[i] ?? "link") === "add_new";
    return true;
  }).length;
  const actionCount = linkedCount + addCount;

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
            {items.map((item, i) => {
              const match = matches[i];
              const choice = matchChoices[i] ?? "link";

              if (match) {
                // ── Reconciliation row ───────────────────────────────
                return (
                  <div
                    key={i}
                    className="bg-[#1A1A1A] border border-orange-500/30 rounded-xl px-4 py-3"
                  >
                    {/* Receipt item name */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm leading-tight">
                          {item.normalized_name}
                        </p>
                        {item.unit_price !== null && (
                          <p className="text-gray-500 text-xs mt-0.5">
                            {item.qty != null ? `${item.qty} ` : ""}
                            {item.unit ? `${item.unit} ` : ""}
                            @ ${item.unit_price.toFixed(2)}
                          </p>
                        )}
                      </div>
                      {item.line_total !== null && (
                        <span className="text-orange-400 font-bold text-sm shrink-0 ml-2">
                          ${item.line_total.toFixed(2)}
                        </span>
                      )}
                    </div>

                    {/* Match banner */}
                    <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2 mb-3">
                      <p className="text-orange-300 text-xs font-semibold mb-0.5">
                        Matches material already logged:
                      </p>
                      <p className="text-white text-xs">
                        {match.material.name}
                        {match.material.unit_cost != null
                          ? ` — $${match.material.unit_cost.toFixed(2)}/${match.material.unit}`
                          : ""}
                        {" · "}
                        <span className="text-gray-400">×{match.material.quantity_ordered} {match.material.unit}</span>
                      </p>
                    </div>

                    {/* Choice buttons */}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setChoice(i, "link")}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-colors active:scale-95 ${
                          choice === "link"
                            ? "bg-green-600/20 border-green-500/40 text-green-400"
                            : "bg-[#242424] border-[#333] text-gray-500"
                        }`}
                      >
                        Link — no new entry
                      </button>
                      <button
                        type="button"
                        onClick={() => setChoice(i, "add_new")}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-colors active:scale-95 ${
                          choice === "add_new"
                            ? "bg-orange-500/20 border-orange-500/40 text-orange-400"
                            : "bg-[#242424] border-[#333] text-gray-500"
                        }`}
                      >
                        Add as new purchase
                      </button>
                    </div>
                  </div>
                );
              }

              // ── Standard checkbox row ────────────────────────────
              return (
                <button
                  key={i}
                  onClick={() => toggle(i)}
                  className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl border text-left transition-colors active:scale-95 ${
                    item.checked
                      ? "bg-[#1A1A1A] border-[#2a2a2a]"
                      : "bg-[#141414] border-[#1e1e1e] opacity-50"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-md border-2 shrink-0 flex items-center justify-center transition-colors ${
                      item.checked
                        ? "bg-orange-500 border-orange-500"
                        : "border-[#444] bg-transparent"
                    }`}
                  >
                    {item.checked && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm leading-tight">
                      {item.normalized_name}
                    </p>
                    {item.normalized_name !== item.raw_name && (
                      <p className="text-gray-600 text-xs mt-0.5 truncate">{item.raw_name}</p>
                    )}
                    {(item.qty !== null || item.unit) && (
                      <p className="text-gray-500 text-xs mt-0.5">
                        {item.qty !== null ? item.qty : ""}
                        {item.unit ? ` ${item.unit}` : ""}
                        {item.unit_price !== null ? ` @ $${item.unit_price.toFixed(2)}` : ""}
                      </p>
                    )}
                  </div>

                  {item.line_total !== null && (
                    <span className="text-orange-400 font-bold text-base shrink-0">
                      ${item.line_total.toFixed(2)}
                    </span>
                  )}
                </button>
              );
            })}
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
            : actionCount === 0
            ? "Confirm Receipt (no materials)"
            : `Confirm — ${addCount > 0 ? `add ${addCount}` : ""}${addCount > 0 && linkedCount > 0 ? ", " : ""}${linkedCount > 0 ? `link ${linkedCount}` : ""}`}
        </button>
      </div>
    </div>
  );
}
