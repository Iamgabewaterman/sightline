"use client";

const MONTHS = ["Feb", "Mar", "Apr"];
const MAT_COSTS = [8200, 12400, 6800];
const maxCost = Math.max(...MAT_COSTS);

export default function DemoInsightsSection() {
  return (
    <div className="mb-10">
      <div className="mb-4">
        <p className="text-orange-500 text-xs font-bold uppercase tracking-widest mb-1">AI Analysis</p>
        <h2 className="text-white font-bold text-xl">Insights</h2>
      </div>

      {/* Alert */}
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-4 mb-5 flex items-start gap-3">
        <span className="text-red-400 text-xl shrink-0">⚠️</span>
        <div>
          <p className="text-red-400 font-bold text-sm">Active Alert</p>
          <p className="text-gray-300 text-sm mt-0.5">Walker Residence is trending <span className="text-red-400 font-bold">15% over</span> labor budget. 38 hrs logged vs. 33 hrs estimated.</p>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">Avg Margin</p>
          <p className="text-white font-black text-3xl">24%</p>
          <p className="text-green-400 text-xs mt-1">Across 3 active jobs</p>
        </div>
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">Top Job Type</p>
          <p className="text-white font-bold text-base leading-tight mt-1">Fire & Flood Restoration</p>
          <p className="text-orange-400 text-xs mt-1">30% avg margin</p>
        </div>
      </div>

      {/* Materials trend chart */}
      <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-5 mb-5">
        <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-4">Materials Cost — Last 3 Months</p>
        <div className="flex items-end gap-4" style={{ height: "96px" }}>
          {MONTHS.map((month, i) => {
            const barH = Math.round((MAT_COSTS[i] / maxCost) * 80);
            const isMax = MAT_COSTS[i] === maxCost;
            return (
              <div key={month} className="flex-1 flex flex-col items-center">
                <div
                  className={`relative w-full rounded-t-lg transition-all ${isMax ? "bg-orange-500" : "bg-[#2e2e2e]"}`}
                  style={{ height: `${barH}px` }}
                >
                  <p className={`absolute top-1.5 left-0 right-0 text-center text-xs font-semibold leading-none ${isMax ? "text-white" : "text-gray-400"}`}>
                    ${(MAT_COSTS[i] / 1000).toFixed(1)}k
                  </p>
                </div>
                <p className="text-gray-500 text-xs mt-1.5">{month}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Job breakdown */}
      <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl overflow-hidden mb-5">
        <div className="px-4 py-3 border-b border-[#2a2a2a]">
          <p className="text-white font-semibold text-sm">Job Profitability</p>
        </div>
        {[
          { name: "Martinez Restoration", margin: 24, type: "Fire & Flood", status: "Active" },
          { name: "Thompson Deck", margin: 26, type: "Decks & Patios", status: "Active" },
          { name: "Chen Bath Remodel", margin: 30, type: "Tile & Plumbing", status: "Completed" },
        ].map((job) => (
          <div key={job.name} className="px-4 py-3 border-b border-[#1e1e1e] last:border-0">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-gray-200 text-sm font-semibold truncate flex-1">{job.name}</p>
              <span className={`text-xs font-bold ml-3 shrink-0 ${
                job.margin >= 28 ? "text-green-400" : "text-orange-400"
              }`}>{job.margin}%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${job.margin >= 28 ? "bg-green-500" : "bg-orange-500"}`}
                  style={{ width: `${(job.margin / 45) * 100}%` }}
                />
              </div>
              <span className="text-gray-600 text-xs shrink-0">{job.type}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
