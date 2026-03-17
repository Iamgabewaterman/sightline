"use client";

import { useState, useEffect, useRef } from "react";
import { useClockContext } from "./ClockContext";
import { getActiveJobs, getDefaultRate, clockIn, clockOut } from "@/app/actions/clock";
import { Job } from "@/types";

function elapsed(startIso: string): string {
  const secs = Math.floor((Date.now() - new Date(startIso).getTime()) / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function ClockWidget() {
  const { activeSession, setActiveSession, clockInOpen, closeClockIn } = useClockContext();

  // ── Live timer ──
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!activeSession) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [activeSession]);

  // ── Clock-in sheet state ──
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [rate, setRate] = useState<string>("");
  const [crewName, setCrewName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!clockInOpen) return;
    setError("");
    getActiveJobs().then((j) => {
      setJobs(j);
      if (j.length > 0) setSelectedJobId(j[0].id);
    });
    getDefaultRate().then((r) => {
      if (r !== null) setRate(String(r));
    });
  }, [clockInOpen]);

  async function handleClockIn() {
    if (!selectedJobId) return setError("Select a job");
    const rateNum = parseFloat(rate);
    if (isNaN(rateNum) || rateNum <= 0) return setError("Enter a valid rate");
    setLoading(true);
    const res = await clockIn(selectedJobId, crewName, rateNum);
    setLoading(false);
    if (res.error) return setError(res.error);
    setActiveSession(res.session!);
    closeClockIn();
  }

  // ── Clock-out confirmation ──
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clockOutLoading, setClockOutLoading] = useState(false);
  const [summary, setSummary] = useState<{ hours: number; total: number } | null>(null);

  async function handleClockOut() {
    if (!activeSession) return;
    setClockOutLoading(true);
    const res = await clockOut(activeSession.id, crewName || "Me", activeSession.rate ?? 0);
    setClockOutLoading(false);
    if (res.error) { setError(res.error); return; }
    setSummary({ hours: res.hours!, total: res.total! });
    setActiveSession(null);
    setConfirmOpen(false);
    setSummaryOpen(true);
  }

  const [summaryOpen, setSummaryOpen] = useState(false);

  return (
    <>
      {/* ── Active session banner (above tab bar) ── */}
      {activeSession && (
        <div
          className="fixed left-0 right-0 z-30 bg-orange-500 flex items-center justify-between px-4 py-2"
          style={{ bottom: "calc(56px + env(safe-area-inset-bottom))" }}
        >
          <div className="flex flex-col leading-tight">
            <span className="text-white font-bold text-sm truncate max-w-[200px]">
              {activeSession.job_name ?? "Clocked In"}
            </span>
            <span className="text-white/80 text-xs font-mono">
              {elapsed(activeSession.clocked_in_at)}
            </span>
          </div>
          <button
            onClick={() => setConfirmOpen(true)}
            className="bg-white text-orange-500 font-bold text-sm px-4 py-1.5 rounded-full active:opacity-70"
          >
            Clock Out
          </button>
        </div>
      )}

      {/* ── Clock-in sheet ── */}
      {clockInOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={closeClockIn} />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
          >
            <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mt-3 mb-5" />
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest px-6 mb-4">Clock In</p>

            <div className="flex flex-col px-5 gap-4">
              {/* Job selector */}
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-1.5">Job</label>
                {jobs.length === 0 ? (
                  <p className="text-gray-500 text-sm">No active jobs</p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                    {jobs.map((j) => (
                      <button
                        key={j.id}
                        onClick={() => setSelectedJobId(j.id)}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border text-left active:scale-95 transition-transform ${
                          selectedJobId === j.id
                            ? "border-orange-500 bg-orange-500/10"
                            : "border-[#2a2a2a] bg-[#1A1A1A]"
                        }`}
                      >
                        <span className={`font-semibold text-sm ${selectedJobId === j.id ? "text-orange-400" : "text-white"}`}>
                          {j.name}
                        </span>
                        {selectedJobId === j.id && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Crew name */}
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-1.5">Your Name (optional)</label>
                <input
                  type="text"
                  value={crewName}
                  onChange={(e) => setCrewName(e.target.value)}
                  placeholder="e.g. Gabe"
                  className="w-full bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* Rate */}
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-1.5">Hourly Rate ($)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-orange-500"
                />
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button
                onClick={handleClockIn}
                disabled={loading || jobs.length === 0}
                className="w-full bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
              >
                {loading ? "Clocking In…" : "Clock In"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Clock-out confirm sheet ── */}
      {confirmOpen && activeSession && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setConfirmOpen(false)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
          >
            <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mt-3 mb-5" />
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest px-6 mb-4">Clock Out</p>

            <div className="flex flex-col px-5 gap-4">
              <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4">
                <p className="text-white font-semibold text-base">{activeSession.job_name ?? "Current Job"}</p>
                <p className="text-gray-400 text-sm mt-1">
                  Elapsed: <span className="font-mono text-white">{elapsed(activeSession.clocked_in_at)}</span>
                </p>
                {activeSession.rate && (
                  <p className="text-gray-400 text-sm">Rate: <span className="text-white">${activeSession.rate}/hr</span></p>
                )}
              </div>

              <p className="text-gray-400 text-sm px-1">
                Clocking out will log this session as a labor entry on the job.
              </p>

              <button
                onClick={handleClockOut}
                disabled={clockOutLoading}
                className="w-full bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
              >
                {clockOutLoading ? "Saving…" : "Confirm Clock Out"}
              </button>

              <button
                onClick={() => setConfirmOpen(false)}
                className="w-full text-gray-400 font-semibold text-base py-3"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Post-clock-out summary sheet ── */}
      {summaryOpen && summary && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setSummaryOpen(false)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
          >
            <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mt-3 mb-5" />
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest px-6 mb-4">Session Complete</p>

            <div className="flex flex-col px-5 gap-3">
              <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5 flex justify-between">
                <div className="text-center flex-1">
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-1">Hours</p>
                  <p className="text-white font-black text-2xl">{summary.hours.toFixed(2)}</p>
                </div>
                <div className="w-px bg-[#2a2a2a]" />
                <div className="text-center flex-1">
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-1">Total</p>
                  <p className="text-orange-400 font-black text-2xl">${summary.total.toFixed(2)}</p>
                </div>
              </div>
              <p className="text-gray-500 text-sm text-center">Labor log added to job.</p>
              <button
                onClick={() => setSummaryOpen(false)}
                className="w-full bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform mt-2"
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
