"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { deleteReceipt, updateReceiptCategory } from "@/app/actions/receipts";
import { ExpenseCategory, Material } from "@/types";
import { CATEGORY_CONFIG, ALL_CATEGORIES, detectCategoryFromVendor } from "@/lib/expense-category";

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  );
}
import { confirmReceiptItems } from "@/app/actions/receipts-vision";
import { Receipt, ReceiptExtractionResult } from "@/types";
import { preprocessReceiptImage } from "@/lib/compress-image";
import ReceiptConfirmationModal from "./ReceiptConfirmationModal";
import { useJobCost } from "@/components/JobCostContext";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

interface DuplicateWarning {
  newReceiptId: string;
  existingId: string;
  vendor: string | null;
  amount: number | null;
  date: string | null;
  extraction: ReceiptExtractionResult;
}

export default function ReceiptsSection({
  jobId,
  initialReceipts,
}: {
  jobId: string;
  initialReceipts: Receipt[];
}) {
  const [receipts, setReceipts] = useState<Receipt[]>(initialReceipts);
  const [uploading, setUploading] = useState(false);
  const [scanStep, setScanStep] = useState<string | null>(null);
  const [scanPct, setScanPct] = useState(0);
  const [error, setError] = useState("");
  const [fullscreen, setFullscreen] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [extraction, setExtraction] = useState<ReceiptExtractionResult | null>(null);
  const [jobMaterials, setJobMaterials] = useState<Material[]>([]);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning | null>(null);
  const [categoryPickerId, setCategoryPickerId] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const { setActualMaterialCost, setActualReceiptTotal, highlightReceiptScan, setHighlightReceiptScan } = useJobCost();
  const [scanHighlighted, setScanHighlighted] = useState(false);

  // Keep receipt total in context in sync
  useEffect(() => {
    setActualReceiptTotal(receipts.reduce((s, r) => s + (r.amount ?? 0), 0));
  }, [receipts, setActualReceiptTotal]);

  // Pulse scan buttons when triggered from quick-add bar
  useEffect(() => {
    if (!highlightReceiptScan) return;
    setHighlightReceiptScan(false);
    setScanHighlighted(true);
    setTimeout(() => setScanHighlighted(false), 1500);
  }, [highlightReceiptScan, setHighlightReceiptScan]);

  function getPublicUrl(path: string) {
    return supabase.storage.from("job-photos").getPublicUrl(path).data.publicUrl;
  }

  async function refreshMaterialCost() {
    const [{ data: receiptData }, { data: materialData }] = await Promise.all([
      supabase.from("receipts").select("*").eq("job_id", jobId).order("created_at", { ascending: false }),
      supabase.from("materials").select("*").eq("job_id", jobId).order("created_at", { ascending: false }),
    ]);
    if (receiptData) setReceipts(receiptData as Receipt[]);
    if (materialData) {
      setJobMaterials(materialData as Material[]);
      const newCost = (materialData as Material[]).reduce((sum, m) => {
        if (m.unit_cost === null) return sum;
        const qty = m.quantity_used ?? m.quantity_ordered;
        return sum + Number(qty) * Number(m.unit_cost);
      }, 0);
      setActualMaterialCost(newCost);
    }
  }

  const SCAN_STEPS: Record<string, number> = {
    received: 20,
    extracting: 45,
    organizing: 70,
    checking: 88,
  };

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setScanStep("Preparing image...");
    setScanPct(5);
    setError("");

    let fileToUpload: Blob = file;
    try {
      fileToUpload = await preprocessReceiptImage(file);
    } catch {
      // preprocessing failed — upload original
    }

    const fd = new FormData();
    fd.append("receipt", fileToUpload, "receipt.jpg");
    fd.append("jobId", jobId);

    let result: { result?: import("@/types").ReceiptExtractionResult; error?: string } | null = null;

    try {
      const resp = await fetch("/api/receipts-vision", { method: "POST", body: fd });

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          if (!part.trim()) continue;
          const lines = part.split("\n");
          let eventType = "message";
          let dataStr = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) eventType = line.slice(7).trim();
            else if (line.startsWith("data: ")) dataStr = line.slice(6).trim();
          }
          if (!dataStr) continue;
          try {
            const data = JSON.parse(dataStr);
            if (eventType === "progress") {
              setScanStep(data.message);
              setScanPct(SCAN_STEPS[data.step] ?? scanPct);
            } else if (eventType === "complete") {
              result = data;
              setScanPct(100);
            } else if (eventType === "error") {
              result = { error: data.error };
            }
          } catch { /* ignore */ }
        }
      }
    } catch {
      result = { error: "Network error — please try again." };
    }

    setUploading(false);
    setScanStep(null);
    setScanPct(0);
    if (cameraRef.current) cameraRef.current.value = "";
    if (libraryRef.current) libraryRef.current.value = "";

    if (!result) return;
    if (result.error) {
      setError(result.error);
      return;
    }

    if (!result.result) return;

    // Fetch fresh job materials for reconciliation check
    const { data: freshMats } = await supabase
      .from("materials")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false });
    setJobMaterials((freshMats as Material[]) ?? []);

    // Scenario 4 — duplicate receipt from same vendor+date
    if (result.result.duplicate_receipt) {
      const dup = result.result.duplicate_receipt;
      setDuplicateWarning({
        newReceiptId: result.result.receipt_id,
        existingId: dup.id,
        vendor: dup.vendor,
        amount: dup.amount,
        date: dup.receipt_date,
        extraction: result.result,
      });
      return;
    }

    // Auto-confirm path: skip modal, add materials immediately
    if (result.result.auto_confirm) {
      await confirmReceiptItems(
        jobId,
        result.result.receipt_id,
        result.result.items,
        result.result.vendor
      );
      await refreshMaterialCost();
      window.dispatchEvent(new CustomEvent("sightline:receipt-confirmed"));
      return;
    }

    setExtraction(result.result);
  }

  async function handleModalDone() {
    setExtraction(null);
    await refreshMaterialCost();
    window.dispatchEvent(new CustomEvent("sightline:receipt-confirmed"));
  }

  async function handleDuplicateYes() {
    // User confirms it's a different purchase — show modal as normal
    if (!duplicateWarning) return;
    const extr = duplicateWarning.extraction;
    setDuplicateWarning(null);
    if (extr.auto_confirm) {
      await confirmReceiptItems(jobId, extr.receipt_id, extr.items, extr.vendor);
      await refreshMaterialCost();
    } else {
      setExtraction(extr);
    }
  }

  async function handleDuplicateNo() {
    // User says it's a duplicate — delete the receipt we just saved
    if (!duplicateWarning) return;
    const receiptId = duplicateWarning.newReceiptId;
    setDuplicateWarning(null);
    await deleteReceipt(receiptId);
    await refreshMaterialCost();
  }

  async function handleCategoryChange(receiptId: string, category: ExpenseCategory) {
    const res = await updateReceiptCategory(receiptId, category);
    if (res.error) { setError(res.error); setCategoryPickerId(null); return; }
    setReceipts((prev) => prev.map((r) => r.id === receiptId ? { ...r, category } : r));
    setCategoryPickerId(null);
  }

  async function handleDeleteConfirmed() {
    if (!confirmDeleteId) return;
    setDeleting(true);
    const res = await deleteReceipt(confirmDeleteId);
    setDeleting(false);
    if (res.error) { setError(res.error); setConfirmDeleteId(null); return; }
    setReceipts((prev) => prev.filter((r) => r.id !== confirmDeleteId));
    setConfirmDeleteId(null);
  }

  const total = receipts.reduce((sum, r) => sum + (r.amount ?? 0), 0);

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-bold text-xl">Receipts</h2>
        {receipts.length > 0 && (
          <span className="text-orange-500 font-bold text-base">
            ${total.toFixed(2)}
          </span>
        )}
      </div>

      {/* Upload buttons */}
      <div className={`flex gap-3 mb-5 rounded-xl transition-all duration-300 ${scanHighlighted ? "ring-2 ring-orange-500 ring-offset-2 ring-offset-[#0F0F0F]" : ""}`}>
        <button
          onClick={() => cameraRef.current?.click()}
          disabled={uploading}
          className={`flex-1 flex items-center justify-center gap-2 border text-white font-semibold text-base py-4 rounded-xl active:scale-95 transition-all disabled:opacity-50 ${scanHighlighted ? "bg-orange-500/10 border-orange-500/50" : "bg-[#1A1A1A] border-[#2a2a2a]"}`}
        >
          <span className="text-xl">📷</span>
          {uploading ? "Scanning..." : "Take Photo"}
        </button>
        <button
          onClick={() => libraryRef.current?.click()}
          disabled={uploading}
          className={`flex-1 flex items-center justify-center gap-2 border text-white font-semibold text-base py-4 rounded-xl active:scale-95 transition-all disabled:opacity-50 ${scanHighlighted ? "bg-orange-500/10 border-orange-500/50" : "bg-[#1A1A1A] border-[#2a2a2a]"}`}
        >
          <span className="text-xl">🖼️</span>
          {uploading ? "Scanning..." : "Library"}
        </button>
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
      <input ref={libraryRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      {uploading && (
        <div className="mb-4 bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-white text-sm font-semibold">{scanStep ?? "Scanning..."}</p>
            <span className="text-orange-500 text-xs font-bold">{scanPct}%</span>
          </div>
          <div className="h-1.5 bg-[#242424] rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${scanPct}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-xl px-4 py-3 mb-4">{error}</p>
      )}

      {receipts.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl py-10 text-center">
          <p className="text-gray-500 text-sm">No receipts yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {receipts.map((r) => {
            const url = getPublicUrl(r.storage_path);
            return (
              <div
                key={r.id}
                className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 flex items-center gap-4"
              >
                <button
                  onClick={() => setFullscreen(url)}
                  className="shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-[#242424] active:scale-95 transition-transform"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                </button>

                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-base truncate">{r.vendor ?? "Receipt"}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-gray-500 text-xs">{formatDate(r.created_at)}</p>
                    {(() => {
                      const cat = r.category ?? detectCategoryFromVendor(r.vendor);
                      const cfg = CATEGORY_CONFIG[cat as ExpenseCategory] ?? CATEGORY_CONFIG.other;
                      return (
                        <button onClick={() => setCategoryPickerId(r.id)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border active:scale-95 ${cfg.bg} ${cfg.color}`}>
                          {cfg.label}
                        </button>
                      );
                    })()}
                  </div>
                  {r.amount === null && (
                    <p className="text-gray-600 text-xs mt-0.5">Could not extract total</p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {r.amount !== null && (
                    <span className="text-orange-500 font-bold text-lg">${r.amount.toFixed(2)}</span>
                  )}
                  <button
                    onClick={() => setConfirmDeleteId(r.id)}
                    aria-label="Delete receipt"
                    className="text-red-400 w-10 h-10 flex items-center justify-center rounded-xl border border-[#2a2a2a] active:scale-95 transition-transform"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            );
          })}

          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 flex justify-between items-center">
            <span className="text-gray-400 font-semibold">Total spent</span>
            <span className="text-white font-bold text-xl">${total.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Category picker */}
      {categoryPickerId && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setCategoryPickerId(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl px-5 pt-6 pb-10">
            <p className="text-white font-bold text-lg mb-4">Set Category</p>
            <div className="grid grid-cols-2 gap-2">
              {ALL_CATEGORIES.map((cat) => {
                const cfg = CATEGORY_CONFIG[cat];
                const receipt = receipts.find((r) => r.id === categoryPickerId);
                const current = receipt?.category ?? detectCategoryFromVendor(receipt?.vendor ?? null);
                return (
                  <button key={cat} onClick={() => handleCategoryChange(categoryPickerId, cat)}
                    className={`py-4 rounded-xl font-semibold text-sm border active:scale-95 transition-transform ${
                      current === cat ? `${cfg.bg} ${cfg.color}` : "bg-[#1A1A1A] border-[#2a2a2a] text-gray-400"
                    }`}>
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setConfirmDeleteId(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl px-5 pt-6 pb-10">
            <p className="text-white font-bold text-lg mb-1">Delete receipt?</p>
            <p className="text-gray-400 text-sm mb-6">This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold text-base py-4 rounded-xl active:scale-95 transition-transform"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirmed}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Fullscreen overlay */}
      {fullscreen && (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center" onClick={() => setFullscreen(null)}>
          <button onClick={() => setFullscreen(null)} className="absolute top-5 right-5 text-white text-4xl leading-none z-10" aria-label="Close">×</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fullscreen} alt="" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* Scenario 4 — duplicate receipt warning */}
      {duplicateWarning && (
        <>
          <div className="fixed inset-0 z-50 bg-black/80" />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl px-5 pt-6 pb-10">
            <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mb-5" />
            <div className="flex items-start gap-3 mb-5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EAB308" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <div>
                <p className="text-white font-bold text-base mb-1">Possible duplicate receipt</p>
                <p className="text-gray-400 text-sm">
                  You already have a receipt from{" "}
                  <span className="text-white font-semibold">{duplicateWarning.vendor ?? "this vendor"}</span>
                  {duplicateWarning.date ? ` on ${duplicateWarning.date}` : ""}
                  {duplicateWarning.amount != null ? ` for $${duplicateWarning.amount.toFixed(2)}` : ""}.
                  Is this a different purchase?
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleDuplicateYes}
                className="w-full bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform"
              >
                Yes, different purchase
              </button>
              <button
                onClick={handleDuplicateNo}
                className="w-full bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold text-base py-4 rounded-xl active:scale-95 transition-transform"
              >
                No, it&apos;s a duplicate — discard
              </button>
            </div>
          </div>
        </>
      )}

      {/* Receipt confirmation modal */}
      {extraction && (
        <ReceiptConfirmationModal
          jobId={jobId}
          extraction={extraction}
          existingMaterials={jobMaterials}
          onDone={handleModalDone}
          onCancel={() => setExtraction(null)}
          onRetry={() => { setExtraction(null); cameraRef.current?.click(); }}
        />
      )}
    </div>
  );
}
