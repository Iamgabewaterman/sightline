"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { TaxReportData, getTaxReport } from "@/app/actions/tax";
import { TaxTransaction, ExpenseCategory } from "@/types";
import { CATEGORY_CONFIG, ALL_CATEGORIES } from "@/lib/expense-category";

function fmt$(n: number) {
  if (n >= 1000) return "$" + (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return "$" + Math.round(n).toLocaleString();
}

function fmtFull$(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function downloadCSV(rows: string[][], filename: string) {
  const csvContent = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export default function TaxClient({ initial }: { initial: TaxReportData }) {
  const [data, setData] = useState<TaxReportData>(initial);
  const [isPending, startTransition] = useTransition();
  const [drillCategory, setDrillCategory] = useState<ExpenseCategory | null>(null);

  function changeYear(year: number) {
    startTransition(async () => {
      const result = await getTaxReport(year);
      setData(result);
      setDrillCategory(null);
    });
  }

  // Group expenses by category
  const expenseByCategory: Record<ExpenseCategory, TaxTransaction[]> = {} as Record<ExpenseCategory, TaxTransaction[]>;
  ALL_CATEGORIES.forEach((cat) => { expenseByCategory[cat] = []; });
  data.expenses.forEach((t) => {
    expenseByCategory[t.category] = expenseByCategory[t.category] ?? [];
    expenseByCategory[t.category].push(t);
  });

  const totalRevenue = data.revenue.reduce((s, t) => s + t.amount, 0);
  const totalExpenses = data.expenses.reduce((s, t) => s + t.amount, 0);
  const netProfit = totalRevenue - totalExpenses;

  function handleExportCSV() {
    const rows: string[][] = [
      ["Date", "Description", "Job", "Category", "Type", "Amount"],
    ];
    data.revenue.forEach((t) => {
      rows.push([fmtDate(t.date), t.description, t.job_name, "Revenue", "Revenue", t.amount.toFixed(2)]);
    });
    data.expenses.forEach((t) => {
      const cfg = CATEGORY_CONFIG[t.category];
      rows.push([fmtDate(t.date), t.description, t.job_name, cfg.label, "Expense", (-t.amount).toFixed(2)]);
    });
    downloadCSV(rows, `tax-report-${data.year}.csv`);
  }

  const drillTransactions = drillCategory ? expenseByCategory[drillCategory] : null;

  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-8 pb-24">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/jobs" className="text-gray-400 text-2xl min-w-[48px] min-h-[48px] flex items-center justify-center active:scale-95">←</Link>
            <h1 className="text-3xl font-bold text-white">Tax Report</h1>
          </div>
          <button onClick={handleExportCSV}
            className="flex items-center gap-1.5 bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold text-sm px-4 py-3 rounded-xl active:scale-95 transition-transform">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            CSV
          </button>
        </div>

        {/* Year selector */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {data.availableYears.map((y) => (
            <button key={y} onClick={() => changeYear(y)} disabled={isPending}
              className={`shrink-0 px-5 py-2.5 rounded-xl font-semibold text-sm border transition-colors active:scale-95 disabled:opacity-50 ${
                y === data.year
                  ? "bg-orange-500/20 border-orange-500/40 text-orange-400"
                  : "bg-[#1A1A1A] border-[#2a2a2a] text-gray-400"
              }`}>
              {y}
            </button>
          ))}
        </div>

        {isPending && <p className="text-gray-500 text-sm text-center mb-4 animate-pulse">Loading…</p>}

        {/* Revenue card */}
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Revenue (Paid Invoices)</p>
            <span className="text-green-400 font-black text-xl">{fmt$(totalRevenue)}</span>
          </div>
          {data.revenue.length === 0 ? (
            <p className="text-gray-600 text-sm">No paid invoices in {data.year}</p>
          ) : (
            <div className="flex flex-col gap-1">
              {data.revenue.map((t, i) => (
                <div key={i} className="flex items-center justify-between py-1 border-t border-[#242424]">
                  <div>
                    <p className="text-white text-sm">{t.job_name}</p>
                    <p className="text-gray-600 text-xs">{fmtDate(t.date)}</p>
                  </div>
                  <span className="text-green-400 font-semibold text-sm">{fmtFull$(t.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expenses by category */}
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Expenses by Category</p>
        <div className="flex flex-col gap-2 mb-4">
          {ALL_CATEGORIES.map((cat) => {
            const txns = expenseByCategory[cat];
            const total = txns.reduce((s, t) => s + t.amount, 0);
            if (total === 0 && txns.length === 0) return null;
            const cfg = CATEGORY_CONFIG[cat];
            const isDrill = drillCategory === cat;
            return (
              <div key={cat}>
                <button
                  onClick={() => setDrillCategory(isDrill ? null : cat)}
                  className={`w-full bg-[#1A1A1A] border rounded-xl px-5 py-4 flex items-center justify-between active:scale-[0.99] transition-transform ${
                    isDrill ? "border-orange-500/40" : "border-[#2a2a2a]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                    <span className="text-gray-500 text-sm">{txns.length} item{txns.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold text-base">{fmt$(total)}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"
                      style={{ transform: isDrill ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </div>
                </button>

                {/* Drill-down */}
                {isDrill && txns.length > 0 && (
                  <div className="mt-1 bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden">
                    {txns.map((t, i) => (
                      <div key={i} className={`flex items-center justify-between px-5 py-3 ${i > 0 ? "border-t border-[#1e1e1e]" : ""}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{t.description}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-gray-600 text-xs">{fmtDate(t.date)}</p>
                            <p className="text-gray-600 text-xs truncate">· {t.job_name}</p>
                          </div>
                        </div>
                        <span className="text-red-400 font-semibold text-sm ml-3 shrink-0">{fmtFull$(t.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Net Profit */}
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5 mb-6">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-4">Summary — {data.year}</p>
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-300 text-sm">Total Revenue</span>
              <span className="text-green-400 font-bold">{fmtFull$(totalRevenue)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300 text-sm">Total Expenses</span>
              <span className="text-red-400 font-bold">({fmtFull$(totalExpenses)})</span>
            </div>
            <div className="border-t border-[#2a2a2a] pt-3 flex justify-between items-center">
              <span className="text-white font-bold text-base">Est. Net Profit</span>
              <span className={`font-black text-2xl ${netProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                {netProfit < 0 ? "(" : ""}{fmtFull$(Math.abs(netProfit))}{netProfit < 0 ? ")" : ""}
              </span>
            </div>
          </div>
        </div>

        <p className="text-gray-600 text-xs text-center">
          For Schedule C filing. Consult your accountant for tax advice.
        </p>
      </div>
    </div>
  );
}
