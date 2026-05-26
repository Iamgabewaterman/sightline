"use client";

import { useState, useEffect } from "react";
import DemoSignupPrompt from "./DemoSignupPrompt";

const IRS_RATE = 0.70;

const DRIVES = [
  { date: "May 5",  from: "Shop — Portland",         to: "Hawthorne Kitchen site",     miles: 11.4, duration: "19 min", purpose: "Delivery — KraftMaid cabinet shipment" },
  { date: "May 6",  from: "Pacific Building Supply",  to: "Hawthorne Kitchen site",     miles: 3.2,  duration: "8 min",  purpose: "Material drop-off — birch plywood" },
  { date: "May 8",  from: "Hawthorne Kitchen",        to: "Riverside Bath site",         miles: 6.9,  duration: "14 min", purpose: "Site check — tile layout" },
  { date: "May 12", from: "Shop",                     to: "Portland Permit Office",      miles: 8.7,  duration: "16 min", purpose: "Permit pickup — Riverside Bath" },
  { date: "May 14", from: "Tile Depot Portland",      to: "Riverside Bath site",         miles: 4.1,  duration: "9 min",  purpose: "Tile delivery — Daltile Perpetuo" },
];

const weekMiles  = DRIVES.reduce((s, d) => s + d.miles, 0);
const monthMiles = weekMiles * 2.4;
const weekDed    = weekMiles * IRS_RATE;
const monthDed   = monthMiles * IRS_RATE;

const fmt = (n: number) => `$${n.toFixed(2)}`;

type DriveState = "idle" | "driving" | "done";

export default function DemoMileageSection() {
  const [driveState, setDriveState] = useState<DriveState>("idle");
  const [simMiles, setSimMiles] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (driveState !== "driving") return;
    const interval = setInterval(() => {
      setTick((t) => {
        const next = t + 1;
        setSimMiles(parseFloat(Math.min((next / 7) * 14.0, 14.0).toFixed(1)));
        if (next >= 7) {
          setDriveState("done");
          clearInterval(interval);
        }
        return next;
      });
    }, 700);
    return () => clearInterval(interval);
  }, [driveState]);

  function startDrive() {
    setTick(0);
    setSimMiles(0);
    setDriveState("driving");
  }

  function resetDrive() {
    setDriveState("idle");
    setTick(0);
    setSimMiles(0);
  }

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

      {/* GPS demo */}
      <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-5 mb-5">
        <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-3">Try It — GPS Demo Drive</p>

        {driveState === "idle" && (
          <>
            <p className="text-gray-400 text-sm mb-3">
              Tap to simulate logging a drive to Riverside Bath site
            </p>
            <button
              onClick={startDrive}
              className="w-full bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform"
            >
              Start Demo Drive
            </button>
          </>
        )}

        {driveState === "driving" && (
          <div className="text-center py-2">
            <div className="w-16 h-16 rounded-full bg-orange-500/20 border-2 border-orange-500 flex items-center justify-center mx-auto mb-3 animate-pulse">
              <span className="text-2xl">📍</span>
            </div>
            <p className="text-white font-bold text-3xl mb-0.5">{simMiles.toFixed(1)} mi</p>
            <p className="text-gray-400 text-sm">GPS tracking in progress…</p>
            <p className="text-green-400 text-xs mt-1 font-semibold">{fmt(simMiles * IRS_RATE)} deduction so far</p>
          </div>
        )}

        {driveState === "done" && (
          <div>
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-4 mb-3">
              <p className="text-green-400 font-bold text-sm mb-1">Drive logged!</p>
              <p className="text-white font-bold text-2xl">14.0 mi</p>
              <p className="text-gray-400 text-xs mt-0.5">Shop → Riverside Bath site · {fmt(14.0 * IRS_RATE)} deduction</p>
            </div>
            <button
              onClick={resetDrive}
              className="w-full bg-[#242424] border border-[#3a3a3a] text-gray-400 font-semibold text-sm py-3 rounded-xl active:scale-95 transition-transform mb-2"
            >
              Reset
            </button>
            <DemoSignupPrompt label="Save mileage logs to your account">
              <button className="w-full bg-orange-500 text-white font-bold text-sm py-3 rounded-xl active:scale-95 transition-transform">
                Save Drive →
              </button>
            </DemoSignupPrompt>
          </div>
        )}
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
