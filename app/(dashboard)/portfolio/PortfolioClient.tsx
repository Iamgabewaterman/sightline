"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Job, JobType, Estimate } from "@/types";

const ALL_TYPES: JobType[] = [
  "drywall","framing","plumbing","paint","trim","roofing",
  "tile","flooring","electrical","hvac","concrete","landscaping",
];
const TYPE_LABELS: Record<string, string> = {
  drywall:"Drywall",framing:"Framing",plumbing:"Plumbing",paint:"Paint",
  trim:"Trim",roofing:"Roofing",tile:"Tile",flooring:"Flooring",
  electrical:"Electrical",hvac:"HVAC",concrete:"Concrete",landscaping:"Landscaping",
};

type JobWithEstimate = Job & { estimate: Estimate | null };

function fmt(n: number) {
  if (n >= 1000) return "$" + (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return "$" + Math.round(n).toLocaleString();
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center bg-[#242424] rounded-xl px-3 py-2.5">
      <span className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider leading-none mb-1">{label}</span>
      <span className="text-white font-bold text-sm leading-none">{value}</span>
    </div>
  );
}

export default function PortfolioClient({ jobs }: { jobs: JobWithEstimate[] }) {
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState<JobType | null>(null);

  const usedTypes = useMemo(() => {
    const s = new Set<JobType>();
    jobs.forEach((j) => j.types.forEach((t) => s.add(t)));
    return ALL_TYPES.filter((t) => s.has(t));
  }, [jobs]);

  const filtered = useMemo(() => {
    let result = jobs;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((j) => j.name.toLowerCase().includes(q));
    }
    if (activeType) {
      result = result.filter((j) => j.types.includes(activeType));
    }
    return result;
  }, [jobs, search, activeType]);

  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 pt-6 pb-8">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-white mb-5">Portfolio</h1>

        {/* Search */}
        <div className="relative mb-4">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search jobs..."
            className="w-full bg-[#1A1A1A] border border-[#2a2a2a] text-white rounded-xl pl-10 pr-4 py-3.5 text-base placeholder:text-gray-600 focus:outline-none focus:border-orange-500"
          />
        </div>

        {/* Type filters */}
        {usedTypes.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-none">
            <button
              onClick={() => setActiveType(null)}
              className={`shrink-0 px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors active:scale-95 ${
                activeType === null
                  ? "bg-orange-500 text-white"
                  : "bg-[#1A1A1A] text-gray-400 border border-[#2a2a2a]"
              }`}
            >
              All
            </button>
            {usedTypes.map((t) => (
              <button
                key={t}
                onClick={() => setActiveType(activeType === t ? null : t)}
                className={`shrink-0 px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors active:scale-95 ${
                  activeType === t
                    ? "bg-orange-500 text-white"
                    : "bg-[#1A1A1A] text-gray-400 border border-[#2a2a2a]"
                }`}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        )}

        {/* Count */}
        <p className="text-gray-500 text-sm mb-4">
          {filtered.length} completed job{filtered.length !== 1 ? "s" : ""}
        </p>

        {/* Job cards */}
        {filtered.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl py-14 text-center">
            <p className="text-gray-500 text-sm">
              {jobs.length === 0
                ? "No completed jobs yet. Mark a job as Completed to see it here."
                : "No jobs match your search."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filtered.map((job) => {
              const est = job.estimate;
              const addonsTotal = est
                ? est.addons.reduce((s, a) => s + a.amount, 0)
                : 0;
              const quoteTotal = est ? est.final_quote + addonsTotal : null;

              return (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="block bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4 active:scale-[0.99] transition-transform"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h2 className="text-white font-bold text-lg leading-tight flex-1">{job.name}</h2>
                    {quoteTotal !== null && (
                      <span className="text-orange-500 font-black text-xl leading-none shrink-0">
                        {fmt(quoteTotal)}
                      </span>
                    )}
                  </div>

                  {/* Address */}
                  {job.address && (
                    <p className="text-gray-500 text-sm mb-3">{job.address}</p>
                  )}

                  {/* Type tags */}
                  {job.types.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {job.types.map((t) => (
                        <span key={t} className="text-[10px] font-bold uppercase tracking-wider text-white bg-[#292929] px-2.5 py-1 rounded-full">
                          {TYPE_LABELS[t] ?? t}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Stats */}
                  {est && (
                    <div className="grid grid-cols-3 gap-2">
                      <StatPill label="Materials" value={fmt(est.material_total)} />
                      <StatPill label="Labor" value={fmt(est.labor_total)} />
                      <StatPill label="Margin" value={`${est.profit_margin_pct}%`} />
                    </div>
                  )}

                  {!est && (
                    <p className="text-gray-600 text-xs">No quote saved</p>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
