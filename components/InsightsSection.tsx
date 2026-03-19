"use client";

import { useState } from "react";
import { InsightCard, InsightBreakdownRow } from "@/lib/insights";

export default function InsightsSection({
  cards,
  completedJobCount,
}: {
  cards: InsightCard[];
  completedJobCount: number;
}) {
  const [selected, setSelected] = useState<InsightCard | null>(null);

  if (completedJobCount < 3) {
    return (
      <div className="mb-8">
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">
          AI Insights
        </p>
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">📊</span>
            <div>
              <p className="text-white font-semibold">Insights unlock at 3 completed jobs</p>
              <p className="text-gray-500 text-sm">
                {completedJobCount === 0
                  ? "Complete your first job to start building your data."
                  : `${completedJobCount} of 3 jobs completed.`}
              </p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 rounded-full transition-all"
              style={{ width: `${Math.min((completedJobCount / 3) * 100, 100)}%` }}
            />
          </div>
          <p className="text-gray-600 text-xs mt-2">
            {3 - completedJobCount} more completed job{3 - completedJobCount !== 1 ? "s" : ""} needed
          </p>
        </div>
      </div>
    );
  }

  if (cards.length === 0) return null;

  return (
    <>
      <div className="mb-8">
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">
          AI Insights
        </p>
        {/* Horizontal scroll row */}
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4" style={{ scrollbarWidth: "none" }}>
          {cards.map((card) => (
            <button
              key={card.id}
              onClick={() => setSelected(card)}
              className="shrink-0 w-56 bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 text-left active:scale-95 transition-transform active:border-orange-500/40"
            >
              <span className="text-2xl block mb-2">{card.icon}</span>
              <p className="text-white text-sm font-semibold leading-snug mb-2">
                {card.headline}
              </p>
              <p className="text-gray-500 text-xs">
                Based on {card.basedOnCount} {card.basedOnLabel} ↗
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom sheet */}
      {selected && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60"
            onClick={() => setSelected(null)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl px-5 pt-5"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
          >
            <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mb-5" />
            <div className="flex items-start gap-3 mb-5">
              <span className="text-3xl">{selected.icon}</span>
              <div>
                <p className="text-white font-bold text-lg leading-snug">{selected.headline}</p>
                <p className="text-gray-500 text-xs mt-1">
                  Based on {selected.basedOnCount} {selected.basedOnLabel}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-0 divide-y divide-[#2a2a2a]">
              {selected.breakdown.map((row: InsightBreakdownRow, i: number) => (
                <div key={i} className="flex items-center justify-between py-3">
                  <span className="text-gray-300 text-sm">{row.label}</span>
                  <div className="text-right">
                    <span className="text-white font-semibold text-sm">{row.value}</span>
                    {row.sub && (
                      <p className="text-gray-500 text-xs">{row.sub}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setSelected(null)}
              className="w-full mt-5 bg-[#1A1A1A] border border-[#2a2a2a] text-gray-400 font-semibold text-base py-4 rounded-xl active:scale-95 transition-transform"
            >
              Close
            </button>
          </div>
        </>
      )}
    </>
  );
}
