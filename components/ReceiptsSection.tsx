"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { deleteReceipt } from "@/app/actions/receipts";
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
  const [extraction, setExtraction] = useState<ReceiptExtractionResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
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
    if (fileRef.current) fileRef.current.value = "";

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

  async function handleDelete(id: string) {
    if (!confirm("Remove this receipt?")) return;
    await deleteReceipt(id);
    setReceipts((prev) => prev.filter((r) => r.id !== id));
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

      {/* Upload button */}
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-full flex items-center justify-center gap-2 bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50 mb-5"
      >
        <span className="text-xl">🧾</span>
        {uploading ? "Reading receipt..." : "Add Receipt"}
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
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
                    onClick={() => handleDelete(r.id)}
                    className="text-red-400 text-sm px-3 py-3 rounded-xl border border-[#2a2a2a] active:scale-95 transition-transform"
                  >
                    ✕
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
