"use client";

import { useEffect, useState } from "react";
import { CATEGORIES, renderCalc, type CategoryId } from "@/app/(dashboard)/calculator/CalculatorClient";
import { CalcAddProvider } from "@/components/CalcAddContext";
import { getCalcPricingForUser } from "@/app/actions/regional-pricing";
import type { RegionalCalcPricing } from "@/lib/regional-pricing-types";
import type { ResultItem } from "@/app/(dashboard)/calculator/calcs/types";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Button label inside the calculator output, e.g. "Add to Cost Reference". */
  addLabel: string;
  /** Called when the contractor taps the add button with the calculated items. */
  onAddResult: (items: ResultItem[], tradeLabel: string) => Promise<void> | void;
}

/**
 * Bottom-sheet calculator. Slides up over the current screen (quote builder or
 * job detail), lets the contractor pick a calculator, run it, and tap the add
 * button — which routes through onAddResult instead of the standalone job picker.
 * Never navigates away from the host screen.
 */
export default function InlineCalculatorDrawer({ open, onClose, title, addLabel, onAddResult }: Props) {
  const [pricing, setPricing] = useState<RegionalCalcPricing | null>(null);
  const [cat, setCat] = useState<CategoryId | null>(null);
  const [sub, setSub] = useState<string | null>(null);

  useEffect(() => {
    if (open && !pricing) {
      getCalcPricingForUser().then(setPricing);
    }
    if (!open) {
      setCat(null);
      setSub(null);
    }
  }, [open, pricing]);

  if (!open) return null;

  const category = CATEGORIES.find((c) => c.id === cat) ?? null;
  const subDef = category?.subs.find((s) => s.id === sub) ?? null;

  async function handleAdd(items: ResultItem[], tradeLabel: string) {
    await onAddResult(items, tradeLabel);
    // Leave the drawer open briefly so the "✓ Added!" state shows, then close.
    setTimeout(onClose, 600);
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/70" onClick={onClose} />
      <div
        className="fixed inset-x-0 bottom-0 z-[60] bg-[#0a0a0a] border-t border-[#2a2a2a] rounded-t-2xl flex flex-col"
        style={{ height: "92vh", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mt-3 mb-2 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-[#1a1a1a] shrink-0">
          <div className="min-w-0">
            {subDef ? (
              <button onClick={() => setSub(null)} className="text-gray-400 text-xs active:scale-95">← {category?.label}</button>
            ) : category ? (
              <button onClick={() => setCat(null)} className="text-gray-400 text-xs active:scale-95">← Calculators</button>
            ) : (
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">{title}</p>
            )}
            <h2 className="text-white font-black text-lg leading-tight truncate">
              {subDef ? subDef.label : category ? `${category.icon} ${category.label}` : "Calculators"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 text-3xl leading-none w-11 h-11 flex items-center justify-center active:scale-95 shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!pricing ? (
            <p className="text-gray-500 text-sm animate-pulse text-center py-10">Loading calculators…</p>
          ) : subDef && category ? (
            <CalcAddProvider handler={{ onAddResult: handleAdd, addLabel }}>
              {renderCalc(category.id, subDef.id, pricing, [])}
            </CalcAddProvider>
          ) : category ? (
            <div className="flex flex-col gap-2">
              {category.subs.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSub(s.id)}
                  className="bg-[#141414] border border-[#2a2a2a] rounded-2xl px-5 py-4 text-left flex items-center gap-4 active:scale-[0.98] transition-transform"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-base leading-tight">{s.label}</p>
                    <p className="text-gray-500 text-xs mt-0.5 leading-snug">{s.desc}</p>
                  </div>
                  <span className="text-gray-600 text-lg shrink-0">›</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCat(c.id)}
                  className="bg-[#141414] border border-[#2a2a2a] rounded-2xl px-4 py-5 text-left flex flex-col gap-2 active:scale-[0.97] transition-transform min-h-[100px]"
                >
                  <span className="text-3xl">{c.icon}</span>
                  <div>
                    <p className="text-white font-bold text-sm leading-tight">{c.label}</p>
                    <p className="text-gray-600 text-xs mt-0.5">{c.subs.length} calc{c.subs.length !== 1 ? "s" : ""}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
