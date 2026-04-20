"use client";

import { useJobCost } from "@/components/JobCostContext";

export default function ProfitBar() {
  const { actualMaterialCost, actualLaborCost, quoteData } = useJobCost();

  if (!quoteData) {
    return (
      <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4">
        <p className="text-gray-500 text-sm text-center">
          Generate a quote first to track profitability.
        </p>
      </div>
    );
  }

  const { materialBudget, laborBudget, finalQuote, addons } = quoteData;
  const addonsTotal = addons.reduce((s, a) => s + a.amount, 0);
  const totalQuote = finalQuote + addonsTotal;

  const totalActual = actualMaterialCost + actualLaborCost;
  const profitBudget = totalQuote - materialBudget - laborBudget;
  const profitRemaining = totalQuote - totalActual;

  const totalBudget = materialBudget + laborBudget;
  const spentPct = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0;

  const materialZonePct = (materialBudget / totalQuote) * 100;
  const laborZonePct = (laborBudget / totalQuote) * 100;

  const fillPct = Math.min((totalActual / totalQuote) * 100, 100);
  const hasData = totalActual > 0;

  const isOverQuote = totalActual >= totalQuote;
  const isOverBudget = totalActual > materialBudget + laborBudget;

  let status = "No costs logged yet";
  let statusColor = "text-gray-500";
  let fillHex = "#F97316";

  if (hasData) {
    if (isOverQuote) {
      status = "Over budget";
      statusColor = "text-red-400";
      fillHex = "#ef4444";
    } else if (isOverBudget) {
      status = "Eating into margin";
      statusColor = "text-yellow-400";
      fillHex = "#eab308";
    } else {
      status = "On track";
      statusColor = "text-orange-500";
      fillHex = "#F97316";
    }
  }

  return (
    <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
          Profitability
        </p>
        <span className={`text-xs font-bold ${statusColor}`}>{status}</span>
      </div>

      {/* Bar */}
      <div className="relative h-7 bg-[#242424] rounded-xl overflow-hidden">
        <div
          className="absolute top-0 bottom-0 bg-[#2a2a2a]"
          style={{ left: `${materialZonePct + laborZonePct}%`, right: 0 }}
        />
        <div
          className="absolute top-0 bottom-0 w-px bg-gray-500 z-10"
          style={{ left: `${materialZonePct}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-px bg-gray-500 z-10"
          style={{ left: `${materialZonePct + laborZonePct}%` }}
        />
        {hasData && (
          <div
            className="absolute top-0 left-0 bottom-0 transition-all duration-700"
            style={{ width: `${fillPct}%`, backgroundColor: fillHex }}
          />
        )}
      </div>

      {/* Zone labels */}
      <div className="relative h-5 mt-1">
        <span
          className="absolute text-gray-500 text-xs"
          style={{ left: `${materialZonePct / 2}%`, transform: "translateX(-50%)" }}
        >
          Mat.
        </span>
        <span
          className="absolute text-gray-500 text-xs"
          style={{
            left: `${materialZonePct + laborZonePct / 2}%`,
            transform: "translateX(-50%)",
          }}
        >
          Labor
        </span>
        <span
          className="absolute text-gray-500 text-xs"
          style={{
            left: `${materialZonePct + laborZonePct + (100 - materialZonePct - laborZonePct) / 2}%`,
            transform: "translateX(-50%)",
          }}
        >
          Profit
        </span>
      </div>

      {/* Plain English summary */}
      <p className={`text-sm mt-3 ${isOverBudget ? "text-yellow-400" : isOverQuote ? "text-red-400" : "text-gray-400"}`}>
        {hasData
          ? `You've used $${Math.round(totalActual).toLocaleString()} of your $${Math.round(totalBudget).toLocaleString()} budget — ${spentPct}% spent`
          : `Your budget is $${Math.round(totalBudget).toLocaleString()} — no costs logged yet`}
      </p>

      {/* Stats */}
      <div className="mt-3 flex flex-col gap-2 border-t border-[#2a2a2a] pt-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Materials logged</span>
          <span>
            <span
              className={`font-semibold ${
                isOverQuote
                  ? "text-red-400"
                  : isOverBudget
                  ? "text-yellow-400"
                  : "text-orange-500"
              }`}
            >
              ${Math.round(actualMaterialCost).toLocaleString()}
            </span>
            <span className="text-gray-500">
              {" "}
              / ${Math.round(materialBudget).toLocaleString()} est.
            </span>
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Labor logged</span>
          <span>
            <span
              className={`font-semibold ${
                isOverQuote ? "text-red-400" : isOverBudget ? "text-yellow-400" : "text-white"
              }`}
            >
              ${Math.round(actualLaborCost).toLocaleString()}
            </span>
            <span className="text-gray-500">
              {" "}
              / ${Math.round(laborBudget).toLocaleString()} est.
            </span>
          </span>
        </div>
        <div className="flex justify-between text-sm border-t border-[#2a2a2a] pt-2">
          <span className="text-gray-400">Total spent</span>
          <span className="text-white font-semibold">
            ${Math.round(totalActual).toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Total quote</span>
          <span className="text-white font-semibold">
            ${Math.round(totalQuote).toLocaleString()}
          </span>
        </div>
        <div
          className={`flex justify-between text-sm font-bold border-t border-[#2a2a2a] pt-2 ${
            profitRemaining < 0 ? "text-red-400" : "text-orange-500"
          }`}
        >
          <span>Profit remaining</span>
          <span>
            {profitRemaining < 0 ? "⚠ -" : ""}$
            {Math.abs(Math.round(profitRemaining)).toLocaleString()}
            {profitRemaining < 0 && (
              <span className="text-xs font-normal text-red-400 ml-1">over budget</span>
            )}
          </span>
        </div>
        {profitBudget > 0 && (
          <div className="flex justify-between text-xs text-gray-600">
            <span>Target profit</span>
            <span>${Math.round(profitBudget).toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}
