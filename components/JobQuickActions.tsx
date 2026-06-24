"use client";

import { useState } from "react";
import { useJobCost } from "@/components/JobCostContext";

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const O = "#F97316";
const PlusBox = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={O} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
    <line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" />
  </svg>
);
const Camera = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={O} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" />
  </svg>
);
const Clock = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={O} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);
const PhotoIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={O} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
  </svg>
);
const DocIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={O} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
    <line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="13" y2="17" />
  </svg>
);

export default function JobQuickActions({ isNew = false }: { isNew?: boolean }) {
  const {
    setOpenMaterialForm,
    setOpenLaborForm,
    setHighlightReceiptScan,
    setOpenCalcDrawer,
    triggerPhoto,
    triggerQuote,
    requestOpen,
  } = useJobCost();
  const [matChoice, setMatChoice] = useState(false);

  function addManual() {
    requestOpen("materials");
    setOpenMaterialForm(true);
    setMatChoice(false);
    scrollTo("section-materials");
  }
  function calcFromMeasure() {
    requestOpen("materials");
    setOpenCalcDrawer(true);
    setMatChoice(false);
  }

  const ACTIONS: { label: string; icon: React.ReactNode; onClick: () => void }[] = [
    { label: "Add Material", icon: PlusBox, onClick: () => setMatChoice(true) },
    { label: "Scan Receipt", icon: Camera, onClick: () => { requestOpen("receipts"); setHighlightReceiptScan(true); scrollTo("section-receipts"); } },
    { label: "Log Labor", icon: Clock, onClick: () => { requestOpen("labor"); setOpenLaborForm(true); scrollTo("section-labor"); } },
    { label: "Add Photo", icon: PhotoIcon, onClick: () => { requestOpen("photos"); triggerPhoto(); } },
    { label: "Generate Quote", icon: DocIcon, onClick: () => triggerQuote() },
  ];

  return (
    <div className="mb-5">
      <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {ACTIONS.map((a) => (
          <button
            key={a.label}
            onClick={a.onClick}
            className={`shrink-0 w-[5.75rem] min-h-[64px] flex flex-col items-center justify-center gap-1.5 bg-[#1A1A1A] border rounded-2xl py-3 active:scale-95 transition-transform ${
              isNew ? "border-orange-500/40 ring-2 ring-orange-500/30 animate-pulse" : "border-[#2a2a2a]"
            }`}
          >
            {a.icon}
            <span className="text-white text-[11px] font-semibold text-center leading-tight px-1">{a.label}</span>
          </button>
        ))}
      </div>

      {matChoice && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setMatChoice(false)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
          >
            <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mt-3 mb-4" />
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest px-6 mb-3">Add Material</p>
            <div className="flex flex-col px-4 gap-2 pb-2">
              <button
                onClick={addManual}
                className="flex items-center gap-4 bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4 active:scale-95 transition-transform text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center shrink-0">{PlusBox}</div>
                <div>
                  <p className="text-white font-semibold text-base">Add Manually</p>
                  <p className="text-gray-500 text-sm">Enter material, quantity, and cost</p>
                </div>
              </button>
              <button
                onClick={calcFromMeasure}
                className="flex items-center gap-4 bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4 active:scale-95 transition-transform text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center shrink-0 text-xl">📐</div>
                <div>
                  <p className="text-white font-semibold text-base">Calculate from Measurements</p>
                  <p className="text-gray-500 text-sm">Run a trade calculator, add the result</p>
                </div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
