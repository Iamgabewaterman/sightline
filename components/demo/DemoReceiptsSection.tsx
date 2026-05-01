"use client";

import { useState, useRef } from "react";
import { demoReceiptOCR, DemoOCRResult } from "@/app/actions/demo-receipt-ocr";

const DEMO_RECEIPTS = [
  {
    id: "r1",
    vendor: "Home Depot #6241",
    amount: 847.32,
    date: "Apr 18, 2026",
    category: "Materials",
    items: [
      { name: "2×4×8 STUD 10PK", qty: 15, unit_price: 38.90, line_total: 583.50 },
      { name: "16D FRAMING NAILS 5LB", qty: 4, unit_price: 11.50, line_total: 46.00 },
      { name: "LVL BEAM 3.5×9.5 4FT", qty: 2, unit_price: 56.98, line_total: 113.96 },
      { name: "JOIST HANGER HUS28", qty: 20, unit_price: 1.18, line_total: 23.60 },
    ],
    badge: "Framing Lumber",
    badgeColor: "bg-orange-500/20 text-orange-400",
  },
  {
    id: "r2",
    vendor: "Parr Lumber – Beaverton",
    amount: 1240.00,
    date: "Apr 20, 2026",
    category: "Materials",
    items: [
      { name: "GAF TIMBERLINE HDZ SHINGLES", qty: 23, unit_price: 92.00, line_total: 2116.00 },
      { name: "30# FELT UNDERLAYMENT 4SQ", qty: 6, unit_price: 38.50, line_total: 231.00 },
      { name: "ICE & WATER SHIELD 2SQ", qty: 2, unit_price: 84.00, line_total: 168.00 },
      { name: "ALUM DRIP EDGE 10FT WHT", qty: 12, unit_price: 9.40, line_total: 112.80 },
    ],
    badge: "Roofing Materials",
    badgeColor: "bg-blue-500/20 text-blue-400",
  },
];

function ScanIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

export default function DemoReceiptsSection() {
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<DemoOCRResult | null>(null);
  const [scanError, setScanError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleScan(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    setScanning(true);
    setScanResult(null);
    setScanError("");

    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let b = 0; b < bytes.length; b++) binary += String.fromCharCode(bytes[b]);
      const base64 = btoa(binary);
      const mimeType = file.type || "image/jpeg";
      const result = await demoReceiptOCR(base64, mimeType);
      setScanResult(result);
    } catch (e) {
      setScanError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-orange-500 text-xs font-bold uppercase tracking-widest mb-1">AI-Powered</p>
          <h2 className="text-white font-bold text-xl">Receipt Scanning</h2>
        </div>
        <span className="text-gray-500 text-xs">2 demo receipts</span>
      </div>

      {/* Demo receipts */}
      <div className="flex flex-col gap-3 mb-5">
        {DEMO_RECEIPTS.map((r) => (
          <div key={r.id} className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl overflow-hidden">
            <div className="px-4 py-4 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-white font-bold text-sm">{r.vendor}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.badgeColor}`}>{r.badge}</span>
                </div>
                <p className="text-gray-500 text-xs">{r.date} · {r.category}</p>
              </div>
              <p className="text-orange-500 font-black text-lg shrink-0">${r.amount.toFixed(2)}</p>
            </div>
            {/* AI-extracted line items */}
            <div className="border-t border-[#1e1e1e] px-4 py-2">
              <p className="text-gray-600 text-[10px] font-bold uppercase tracking-wider mb-2">AI Extracted Items</p>
              <div className="flex flex-col gap-1">
                {r.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-gray-400 truncate flex-1">{item.name}</span>
                    <span className="text-gray-500 mx-2 shrink-0">{item.qty} ea</span>
                    <span className="text-gray-300 font-semibold shrink-0">${item.line_total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Live scan button */}
      <div className="bg-[#1A1A1A] border border-orange-500/20 rounded-xl p-4 mb-3">
        <p className="text-gray-400 text-sm mb-3 text-center">Try it with a real receipt — AI scans and extracts fields instantly. Nothing is saved.</p>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={scanning}
          className="w-full bg-orange-500 text-white font-bold text-base py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
        >
          <ScanIcon />
          {scanning ? "Scanning with AI…" : "Scan a Receipt"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleScan(e.target.files)}
        />
      </div>

      {/* Scan result */}
      {scanning && (
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-6 flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Claude is reading your receipt…</p>
        </div>
      )}

      {scanError && (
        <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-xl px-4 py-3">{scanError}</p>
      )}

      {scanResult && !scanning && (
        <div className="bg-[#1A1A1A] border border-green-500/30 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#2a2a2a] flex items-center gap-2">
            <span className="text-green-400 text-sm font-bold">✓ AI Extracted</span>
            <span className="text-gray-600 text-xs">— not saved to database</span>
          </div>
          <div className="px-4 py-4">
            {scanResult.image_unclear ? (
              <p className="text-yellow-400 text-sm">Image was unclear — try a clearer photo in better lighting.</p>
            ) : (
              <>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-white font-bold text-base">{scanResult.vendor ?? "Unknown vendor"}</p>
                    {scanResult.date && <p className="text-gray-500 text-xs mt-0.5">{scanResult.date}</p>}
                  </div>
                  {scanResult.total !== null && (
                    <p className="text-orange-500 font-black text-xl">${scanResult.total.toFixed(2)}</p>
                  )}
                </div>
                {scanResult.items.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <p className="text-gray-600 text-[10px] font-bold uppercase tracking-wider mb-1">Line Items ({scanResult.items.length})</p>
                    {scanResult.items.slice(0, 8).map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-gray-400 truncate flex-1">{item.raw_name}</span>
                        {item.line_total !== null && (
                          <span className="text-gray-300 font-semibold ml-2 shrink-0">${item.line_total.toFixed(2)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="px-4 py-3 border-t border-[#1e1e1e] bg-[#141414]">
            <p className="text-gray-500 text-xs text-center">Sign up to save this receipt to a job and track spending automatically</p>
          </div>
        </div>
      )}
    </div>
  );
}
