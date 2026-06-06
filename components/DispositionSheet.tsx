"use client";

import { useState } from "react";
import { disposeMaterialReturn, disposeMaterialStore } from "@/app/actions/inventory";

interface Props {
  materialId: string;
  materialName: string;
  surplusQty: number;
  unit: string;
  unitCost: number | null;
  jobId: string;
  jobName: string;
  jobNumber: string | null;
  onClose: () => void;
  onReturn: (newQtyUsed: number, newActualCost: number | null, disposedQty: number) => void;
  onStore: (disposedQty: number) => void;
}

function Spinner() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M21 12a9 9 0 11-6.219-8.56"/>
    </svg>
  );
}

export default function DispositionSheet({
  materialId,
  materialName,
  surplusQty,
  unit,
  unitCost,
  jobId,
  jobName,
  jobNumber,
  onClose,
  onReturn,
  onStore,
}: Props) {
  const [qty, setQty] = useState(surplusQty.toString());
  const [loadingReturn, setLoadingReturn] = useState(false);
  const [loadingStore, setLoadingStore] = useState(false);
  const [error, setError] = useState("");

  const parsedQty = parseFloat(qty) || 0;
  const value = unitCost != null ? parsedQty * unitCost : null;
  const anyLoading = loadingReturn || loadingStore;

  async function handleReturn() {
    if (parsedQty <= 0) { setError("Enter a valid quantity."); return; }
    setLoadingReturn(true); setError("");
    const result = await disposeMaterialReturn(materialId, parsedQty);
    if (result.error) { setError(result.error); setLoadingReturn(false); return; }
    onReturn(result.newQuantityUsed!, result.newActualCost ?? null, parsedQty);
  }

  async function handleStore() {
    if (parsedQty <= 0) { setError("Enter a valid quantity."); return; }
    setLoadingStore(true); setError("");
    const result = await disposeMaterialStore(materialId, parsedQty, jobId, jobName, jobNumber);
    if (result.error) { setError(result.error); setLoadingStore(false); return; }
    onStore(parsedQty);
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70" onClick={anyLoading ? undefined : onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl px-5 pt-5 pb-10">
        <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mb-5" />

        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-orange-500/15 flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-tight">Dispose Surplus</p>
            <p className="text-gray-500 text-sm truncate">{materialName}</p>
          </div>
        </div>

        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-3 mb-4 mt-3">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Surplus available</p>
          <p className="text-white font-bold text-xl">{surplusQty} {unit}</p>
          {unitCost != null && (
            <p className="text-gray-500 text-xs mt-0.5">${unitCost.toFixed(2)}/{unit} · ${(surplusQty * unitCost).toFixed(2)} total value</p>
          )}
        </div>

        <div className="mb-4">
          <label className="text-gray-400 text-xs uppercase tracking-wider block mb-1.5">
            Quantity to dispose
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              disabled={anyLoading}
              className="flex-1 bg-[#242424] border border-[#333333] text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500 disabled:opacity-50"
            />
            <span className="text-gray-400 text-sm font-semibold">{unit}</span>
          </div>
          {value != null && parsedQty > 0 && (
            <p className="text-orange-400 text-xs mt-1.5 font-semibold">= ${value.toFixed(2)} value</p>
          )}
        </div>

        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

        <div className="flex flex-col gap-2">
          <button
            onClick={handleReturn}
            disabled={anyLoading}
            className="w-full bg-green-600 text-white font-bold py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loadingReturn ? <Spinner /> : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
              </svg>
            )}
            {loadingReturn ? "Processing…" : "Return to Supplier"}
            {!loadingReturn && value != null && parsedQty > 0 && (
              <span className="text-green-200 font-normal text-sm">(−${value.toFixed(2)})</span>
            )}
          </button>

          <button
            onClick={handleStore}
            disabled={anyLoading}
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loadingStore ? <Spinner /> : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/>
              </svg>
            )}
            {loadingStore ? "Storing…" : "Store in Shop"}
          </button>

          <button
            onClick={onClose}
            disabled={anyLoading}
            className="w-full bg-[#1A1A1A] border border-[#2a2a2a] text-gray-300 font-semibold py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
          >
            Keep on Job
          </button>
        </div>
      </div>
    </>
  );
}
