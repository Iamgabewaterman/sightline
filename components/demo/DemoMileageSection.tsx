"use client";

import DemoSignupPrompt from "./DemoSignupPrompt";

const IRS_RATE = 0.70;

const DRIVES = [
  { date: "Apr 18", from: "Shop", to: "Meredith Johnson job site", miles: 14.2, duration: "22 min", purpose: "Framing delivery & site check" },
  { date: "Apr 19", from: "Home Depot", to: "Walker Residence", miles: 6.8, duration: "12 min", purpose: "Material drop-off" },
  { date: "Apr 22", from: "Walker Residence", to: "Martinez Restoration job", miles: 8.4, duration: "17 min", purpose: "Site inspection" },
  { date: "Apr 24", from: "Shop", to: "Portland Permit Office", miles: 12.1, duration: "24 min", purpose: "Permit pickup – Thompson deck" },
  { date: "Apr 25", from: "Thompson job site", to: "Shop", miles: 9.3, duration: "18 min", purpose: "End of day return" },
];

const weekMiles   = DRIVES.reduce((s, d) => s + d.miles, 0);
const monthMiles  = weekMiles * 2.4; // extrapolate to month
const weekDed     = weekMiles * IRS_RATE;
const monthDed    = monthMiles * IRS_RATE;

const fmt = (n: number) => `$${n.toFixed(2)}`;

export default function DemoMileageSection() {
  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-orange-500 text-xs font-bold uppercase tracking-widest mb-1">IRS Mileage Log</p>
          <h2 className="text-white font-bold text-xl">Mileage Tracker</h2>
        </div>
        <span className="text-gray-500 text-xs">$0.70/mi IRS rate</span>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">This Week</p>
          <p className="text-white font-bold text-xl">{weekMiles.toFixed(1)} mi</p>
          <p className="text-green-400 text-sm font-semibold mt-0.5">{fmt(weekDed)} deduction</p>
        </div>
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">This Month</p>
          <p className="text-white font-bold text-xl">{Math.round(monthMiles)} mi</p>
          <p className="text-green-400 text-sm font-semibold mt-0.5">{fmt(monthDed)} deduction</p>
        </div>
      </div>

      {/* Drive log */}
      <div className="flex flex-col gap-2 mb-5">
        {DRIVES.map((d, i) => (
          <div key={i} className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="min-w-0">
                <p className="text-white font-semibold text-sm">{d.from} → {d.to}</p>
                <p className="text-gray-500 text-xs mt-0.5">{d.purpose}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-white font-bold text-sm">{d.miles} mi</p>
                <p className="text-green-400 text-xs font-semibold">{fmt(d.miles * IRS_RATE)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-gray-600 text-xs">{d.date}</span>
              <span className="text-gray-600 text-xs">·</span>
              <span className="text-gray-600 text-xs">{d.duration}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Export */}
      <DemoSignupPrompt label="Export mileage to CSV">
        <button className="w-full bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold text-base py-4 rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-2">
          <span>⬇️</span> Export CSV for Taxes
        </button>
      </DemoSignupPrompt>
    </div>
  );
}
