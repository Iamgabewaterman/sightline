"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

export interface ProfitRow {
  jobId: string;
  jobName: string;
  jobTypes: string[];
  jobStatus: string;
  createdAt: string;
  completedDate: string | null;
  quotedTotal: number | null;
  quotedMaterials: number | null;
  actualMaterials: number;
  actualLabor: number;
  actualCost: number;
  revenue: number | null;
  profit: number | null;
  marginPct: number | null;
  hasQuote: boolean;
}

export interface ProfitInsight {
  mostProfitableType: string | null;
  mostProfitableTypeMargin: number | null;
  mostOverBudgetType: string | null;
  mostOverBudgetTypePct: number | null;
}

const JOB_TYPE_LABELS: Record<string, string> = {
  drywall: "Drywall", framing: "Framing", plumbing: "Plumbing",
  paint: "Paint", trim: "Trim", roofing: "Roofing", tile: "Tile",
  flooring: "Flooring", electrical: "Electrical", hvac: "HVAC",
  concrete: "Concrete", landscaping: "Landscaping", decks_patios: "Decks & Patios", fencing: "Fencing",
};

const ALL_TYPES = Object.keys(JOB_TYPE_LABELS);

function fmt(n: number) {
  return "$" + Math.round(Math.abs(n)).toLocaleString();
}

function fmtSigned(n: number) {
  return `${n < 0 ? "−" : ""}${fmt(n)}`;
}

function marginColor(pct: number | null) {
  if (pct === null) return "text-gray-500";
  if (pct >= 20) return "text-green-400";
  if (pct >= 10) return "text-yellow-400";
  return "text-red-400";
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "text-orange-400 bg-orange-900/30 border-orange-800/50",
    completed: "text-green-400 bg-green-900/30 border-green-800/50",
    on_hold: "text-yellow-400 bg-yellow-900/30 border-yellow-800/50",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${map[status] ?? "text-gray-400 bg-gray-800 border-gray-700"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function exportCSV(rows: ProfitRow[]) {
  const headers = ["Job Name", "Types", "Status", "Quoted", "Actual Cost", "Profit", "Margin %", "Date"];
  const lines = [
    headers.join(","),
    ...rows.map((r) => [
      `"${r.jobName.replace(/"/g, '""')}"`,
      `"${r.jobTypes.map((t) => JOB_TYPE_LABELS[t] ?? t).join(", ")}"`,
      r.jobStatus,
      r.quotedTotal !== null ? Math.round(r.quotedTotal) : "",
      Math.round(r.actualCost),
      r.profit !== null ? Math.round(r.profit) : "",
      r.marginPct !== null ? r.marginPct.toFixed(1) + "%" : "",
      r.completedDate ? r.completedDate.slice(0, 10) : r.createdAt.slice(0, 10),
    ].join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "profitability-report.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export default function ProfitClient({
  rows,
  insights,
}: {
  rows: ProfitRow[];
  insights: ProfitInsight | null;
}) {
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterType !== "all" && !r.jobTypes.includes(filterType)) return false;
      if (filterStatus !== "all" && r.jobStatus !== filterStatus) return false;
      const date = r.completedDate ?? r.createdAt;
      if (filterFrom && date < filterFrom) return false;
      if (filterTo && date > filterTo + "T23:59:59") return false;
      return true;
    });
  }, [rows, filterType, filterStatus, filterFrom, filterTo]);

  // Sort by profit descending (nulls last)
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.profit === null && b.profit === null) return 0;
      if (a.profit === null) return 1;
      if (b.profit === null) return -1;
      return b.profit - a.profit;
    });
  }, [filtered]);

  // Summary cards from filtered rows
  const totalRevenue = filtered.reduce((s, r) => s + (r.revenue ?? 0), 0);
  const totalCost = filtered.reduce((s, r) => s + r.actualCost, 0);
  const netProfit = filtered
    .filter((r) => r.profit !== null)
    .reduce((s, r) => s + (r.profit ?? 0), 0);
  const margins = filtered.filter((r) => r.marginPct !== null).map((r) => r.marginPct!);
  const avgMargin = margins.length > 0 ? margins.reduce((a, b) => a + b, 0) / margins.length : null;

  const hasFilters = filterType !== "all" || filterStatus !== "all" || filterFrom || filterTo;

  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-8 pb-24">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <p className="text-gray-400 text-sm uppercase tracking-widest mb-1">Sightline</p>
          <h1 className="text-3xl font-bold text-white">Profitability</h1>
        </div>

        {/* AI Insights */}
        {insights && (insights.mostProfitableType || insights.mostOverBudgetType) && (
          <div className="mb-6 flex flex-col gap-3">
            {insights.mostProfitableType && insights.mostProfitableTypeMargin !== null && (
              <div className="bg-green-900/20 border border-green-800/50 rounded-xl px-4 py-3">
                <p className="text-green-400 text-xs font-bold uppercase tracking-wider mb-0.5">Top Performer</p>
                <p className="text-white text-sm font-semibold">
                  Your most profitable job type is{" "}
                  <span className="text-green-400">{JOB_TYPE_LABELS[insights.mostProfitableType] ?? insights.mostProfitableType}</span>
                  , averaging{" "}
                  <span className="text-green-400">{insights.mostProfitableTypeMargin.toFixed(1)}% margin</span>
                </p>
              </div>
            )}
            {insights.mostOverBudgetType && insights.mostOverBudgetTypePct !== null && (
              <div className="bg-red-900/20 border border-red-800/50 rounded-xl px-4 py-3">
                <p className="text-red-400 text-xs font-bold uppercase tracking-wider mb-0.5">Watch Out</p>
                <p className="text-white text-sm font-semibold">
                  Your{" "}
                  <span className="text-red-400">{JOB_TYPE_LABELS[insights.mostOverBudgetType] ?? insights.mostOverBudgetType}</span>
                  {" "}jobs average{" "}
                  <span className="text-red-400">{insights.mostOverBudgetTypePct.toFixed(1)}% over material budget</span>
                  {" "}— consider adjusting quotes
                </p>
              </div>
            )}
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Total Revenue</p>
            <p className="text-white font-black text-2xl">{fmt(totalRevenue)}</p>
            <p className="text-gray-600 text-xs mt-0.5">paid invoices</p>
          </div>
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Job Costs</p>
            <p className="text-white font-black text-2xl">{fmt(totalCost)}</p>
            <p className="text-gray-600 text-xs mt-0.5">materials + labor</p>
          </div>
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Net Profit</p>
            <p className={`font-black text-2xl ${netProfit >= 0 ? "text-orange-500" : "text-red-400"}`}>
              {fmtSigned(netProfit)}
            </p>
            <p className="text-gray-600 text-xs mt-0.5">quoted − actual</p>
          </div>
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Avg Margin</p>
            <p className={`font-black text-2xl ${avgMargin === null ? "text-gray-600" : marginColor(avgMargin)}`}>
              {avgMargin !== null ? `${avgMargin.toFixed(1)}%` : "—"}
            </p>
            <p className="text-gray-600 text-xs mt-0.5">{margins.length} jobs tracked</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 mb-4 flex flex-col gap-3">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Filters</p>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-[#111] border border-[#2a2a2a] text-white text-sm rounded-xl px-3 py-3 focus:outline-none focus:border-orange-500"
            >
              <option value="all">All types</option>
              {ALL_TYPES.map((t) => (
                <option key={t} value={t}>{JOB_TYPE_LABELS[t]}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-[#111] border border-[#2a2a2a] text-white text-sm rounded-xl px-3 py-3 focus:outline-none focus:border-orange-500"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="on_hold">On Hold</option>
            </select>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              placeholder="From"
              className="bg-[#111] border border-[#2a2a2a] text-white text-sm rounded-xl px-3 py-3 focus:outline-none focus:border-orange-500"
            />
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              placeholder="To"
              className="bg-[#111] border border-[#2a2a2a] text-white text-sm rounded-xl px-3 py-3 focus:outline-none focus:border-orange-500"
            />
          </div>
          {hasFilters && (
            <button
              onClick={() => { setFilterType("all"); setFilterStatus("all"); setFilterFrom(""); setFilterTo(""); }}
              className="text-gray-500 text-xs font-semibold text-left active:text-white"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Jobs table */}
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
              {sorted.length} Job{sorted.length !== 1 ? "s" : ""}
            </p>
            <button
              onClick={() => exportCSV(sorted)}
              className="flex items-center gap-1.5 text-gray-400 text-xs font-semibold border border-[#2a2a2a] px-3 py-2 rounded-lg active:scale-95 transition-transform min-h-[36px]"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export CSV
            </button>
          </div>

          {sorted.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-gray-600 text-sm">No jobs match the current filters.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#222]">
              {sorted.map((row) => (
                <Link
                  key={row.jobId}
                  href={`/jobs/${row.jobId}`}
                  className="block px-5 py-4 active:bg-[#222] transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="text-white font-semibold text-base leading-tight truncate">{row.jobName}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {row.jobTypes.slice(0, 3).map((t) => (
                          <span key={t} className="text-orange-400 text-xs bg-orange-500/10 px-2 py-0.5 rounded-full">
                            {JOB_TYPE_LABELS[t] ?? t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <StatusBadge status={row.jobStatus} />
                      {row.marginPct !== null && (
                        <p className={`text-sm font-bold mt-1 ${marginColor(row.marginPct)}`}>
                          {row.marginPct.toFixed(1)}%
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-gray-600 text-xs">Quoted</p>
                      <p className="text-gray-300 font-medium">
                        {row.quotedTotal !== null ? fmt(row.quotedTotal) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-xs">Actual Cost</p>
                      <p className="text-gray-300 font-medium">
                        {row.actualCost > 0 ? fmt(row.actualCost) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-xs">Profit</p>
                      <p className={`font-semibold ${
                        row.profit === null ? "text-gray-600" :
                        row.profit >= 0 ? "text-white" : "text-red-400"
                      }`}>
                        {row.profit !== null ? fmtSigned(row.profit) : "—"}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Margin legend */}
        <div className="flex items-center gap-4 justify-center text-xs text-gray-600 mb-2">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> ≥20% margin</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> 10–20%</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> &lt;10%</span>
        </div>
      </div>
    </div>
  );
}
