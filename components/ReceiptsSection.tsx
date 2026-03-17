"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { deleteReceipt } from "@/app/actions/receipts";

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
import { extractReceiptItems, confirmReceiptItems } from "@/app/actions/receipts-vision";
import { Receipt, ReceiptExtractionResult } from "@/types";
import { compressImage } from "@/lib/compress-image";
import ReceiptConfirmationModal from "./ReceiptConfirmationModal";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
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
  const [error, setError] = useState("");
  const [fullscreen, setFullscreen] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [extraction, setExtraction] = useState<ReceiptExtractionResult | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  function getPublicUrl(path: string) {
    return supabase.storage.from("job-photos").getPublicUrl(path).data.publicUrl;
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");

    let fileToUpload: Blob = file;
    try {
      fileToUpload = await compressImage(file);
    } catch {
      // compression failed — upload original
    }

    const fd = new FormData();
    fd.append("receipt", fileToUpload, "receipt.jpg");
    const result = await extractReceiptItems(jobId, fd);

    setUploading(false);
    if (cameraRef.current) cameraRef.current.value = "";
    if (libraryRef.current) libraryRef.current.value = "";

    if (result.error) {
      setError(result.error);
      return;
    }

    if (!result.result) return;

    if (result.result.image_unclear) {
      setError("Image is unclear — please retake the photo in better lighting.");
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
      // Reload the receipt list
      const { data } = await supabase
        .from("receipts")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false });
      if (data) setReceipts(data as Receipt[]);
      return;
    }

    // Show confirmation modal
    setExtraction(result.result);
  }

  async function handleModalDone() {
    setExtraction(null);
    // Reload receipts
    const { data } = await supabase
      .from("receipts")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false });
    if (data) setReceipts(data as Receipt[]);
  }

  async function handleDeleteConfirmed() {
    if (!confirmDeleteId) return;
    setDeleting(true);
    await deleteReceipt(confirmDeleteId);
    setReceipts((prev) => prev.filter((r) => r.id !== confirmDeleteId));
    setConfirmDeleteId(null);
    setDeleting(false);
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
      <div className="flex gap-3 mb-5">
        <button
          onClick={() => cameraRef.current?.click()}
          disabled={uploading}
          className="flex-1 flex items-center justify-center gap-2 bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
        >
          <span className="text-xl">📷</span>
          {uploading ? "Scanning..." : "Take Photo"}
        </button>
        <button
          onClick={() => libraryRef.current?.click()}
          disabled={uploading}
          className="flex-1 flex items-center justify-center gap-2 bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
        >
          <span className="text-xl">🖼️</span>
          {uploading ? "Scanning..." : "Library"}
        </button>
      </div>

      {/* Camera input — opens camera directly */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
      {/* Library input — opens photo picker, no capture attribute */}
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />

      {uploading && (
        <p className="text-gray-400 text-sm mb-4 animate-pulse">
          Scanning receipt with AI...
        </p>
      )}

      {error && (
        <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-xl px-4 py-3 mb-4">
          {error}
        </p>
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
                {/* Thumbnail */}
                <button
                  onClick={() => setFullscreen(url)}
                  className="shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-[#242424] active:scale-95 transition-transform"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-base truncate">
                    {r.vendor ?? "Receipt"}
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {formatDate(r.created_at)}
                  </p>
                  {r.amount === null && (
                    <p className="text-gray-600 text-xs mt-0.5">
                      Could not extract total
                    </p>
                  )}
                </div>

                {/* Amount */}
                <div className="flex items-center gap-3">
                  {r.amount !== null && (
                    <span className="text-orange-500 font-bold text-lg">
                      ${r.amount.toFixed(2)}
                    </span>
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

          {/* Total row */}
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 flex justify-between items-center">
            <span className="text-gray-400 font-semibold">Total spent</span>
            <span className="text-white font-bold text-xl">
              ${total.toFixed(2)}
            </span>
          </div>
        </div>
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
        <div
          className="fixed inset-0 bg-black z-50 flex items-center justify-center"
          onClick={() => setFullscreen(null)}
        >
          <button
            onClick={() => setFullscreen(null)}
            className="absolute top-5 right-5 text-white text-4xl leading-none z-10"
            aria-label="Close"
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fullscreen}
            alt=""
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Receipt confirmation modal */}
      {extraction && (
        <ReceiptConfirmationModal
          jobId={jobId}
          extraction={extraction}
          onDone={handleModalDone}
          onCancel={() => setExtraction(null)}
        />
      )}
    </div>
  );
}
