"use client";

import { useState } from "react";
import Link from "next/link";
import { MileageLog, Job } from "@/types";
import { addMileageLog, deleteMileageLog } from "@/app/actions/mileage";

function fmt$(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const inputCls = "bg-[#242424] border border-[#333] text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500 w-full";

export default function MileageClient({
  initialLogs,
  jobs,
  ytdMiles: initYtdMiles,
  ytdDeduction: initYtdDeduction,
  irsRate,
}: {
  initialLogs: MileageLog[];
  jobs: Pick<Job, "id" | "name">[];
  ytdMiles: number;
  ytdDeduction: number;
  irsRate: number;
}) {
  const [logs, setLogs] = useState<MileageLog[]>(initialLogs);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [description, setDescription] = useState("");
  const [miles, setMiles] = useState("");
  const [jobId, setJobId] = useState("");
  const [logDate, setLogDate] = useState(new Date().toISOString().split("T")[0]);

  const currentYear = new Date().getFullYear();
  const ytdLogs = logs.filter((l) => new Date(l.log_date).getFullYear() === currentYear);
  const ytdMiles = ytdLogs.reduce((s, l) => s + Number(l.miles), 0);
  const ytdDeduction = ytdLogs.reduce((s, l) => s + Number(l.deduction), 0);

  const previewDeduction = miles ? Math.round(parseFloat(miles) * irsRate * 100) / 100 : null;

  async function handleAdd() {
    setError("");
    const fd = new FormData();
    fd.set("description", description);
    fd.set("miles", miles);
    fd.set("job_id", jobId);
    fd.set("log_date", logDate);
    setSaving(true);
    const res = await addMileageLog(fd);
    setSaving(false);
    if (res.error) { setError(res.error); return; }
    setLogs((prev) => [res.log!, ...prev]);
    setDescription(""); setMiles(""); setJobId("");
    setLogDate(new Date().toISOString().split("T")[0]);
    setShowForm(false);
  }

  async function handleDelete() {
    if (!confirmDeleteId) return;
    setDeleting(true);
    await deleteMileageLog(confirmDeleteId);
    setLogs((prev) => prev.filter((l) => l.id !== confirmDeleteId));
    setConfirmDeleteId(null);
    setDeleting(false);
  }

  // Group by month
  const grouped = logs.reduce<Record<string, MileageLog[]>>((acc, log) => {
    const key = new Date(log.log_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (!acc[key]) acc[key] = [];
    acc[key].push(log);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-8 pb-24">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/jobs" className="text-gray-400 text-2xl min-w-[48px] min-h-[48px] flex items-center justify-center active:scale-95">←</Link>
            <h1 className="text-3xl font-bold text-white">Mileage</h1>
          </div>
          <button
            onClick={() => { setShowForm((s) => !s); setError(""); }}
            className="bg-orange-500 text-white font-bold text-sm px-4 py-3 rounded-xl active:scale-95 transition-transform"
          >
            {showForm ? "Cancel" : "+ Log Trip"}
          </button>
        </div>

        {/* YTD Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 text-center">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">YTD Miles</p>
            <p className="text-white font-black text-2xl leading-none">{ytdMiles.toLocaleString("en-US", { maximumFractionDigits: 1 })}</p>
          </div>
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 text-center">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">YTD Deduction</p>
            <p className="text-orange-400 font-black text-2xl leading-none">{fmt$(ytdDeduction)}</p>
          </div>
        </div>
        <p className="text-gray-600 text-xs text-center mb-6">IRS rate: ${irsRate}/mile ({new Date().getFullYear()})</p>

        {/* Add form */}
        {showForm && (
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5 mb-6 flex flex-col gap-3">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Log Trip</p>
            <input value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (e.g. Home Depot run, client meeting)" className={inputCls} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wider block mb-1">Miles</label>
                <input type="number" inputMode="decimal" min="0" step="0.1"
                  value={miles} onChange={(e) => setMiles(e.target.value)}
                  placeholder="0.0" className={inputCls} />
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wider block mb-1">Date</label>
                <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} className={inputCls} />
              </div>
            </div>
            {jobs.length > 0 && (
              <select value={jobId} onChange={(e) => setJobId(e.target.value)}
                className={inputCls + " appearance-none"}>
                <option value="">No job linked</option>
                {jobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            )}
            {previewDeduction !== null && (
              <p className="text-orange-400 font-semibold text-sm">
                Deduction: {fmt$(previewDeduction)}
              </p>
            )}
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button onClick={handleAdd} disabled={saving}
              className="w-full bg-orange-500 text-white font-bold py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50">
              {saving ? "Saving…" : "Add Trip"}
            </button>
          </div>
        )}

        {/* Log list */}
        {logs.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl py-16 text-center">
            <p className="text-gray-500 text-base mb-2">No mileage logged yet</p>
            <p className="text-gray-600 text-sm">Every business mile you drive is a deduction.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {Object.entries(grouped).map(([month, monthLogs]) => {
              const monthMiles = monthLogs.reduce((s, l) => s + Number(l.miles), 0);
              const monthDeduction = monthLogs.reduce((s, l) => s + Number(l.deduction), 0);
              return (
                <div key={month}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">{month}</p>
                    <p className="text-gray-500 text-xs">{monthMiles.toFixed(1)} mi · {fmt$(monthDeduction)}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {monthLogs.map((log) => (
                      <div key={log.id} className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold text-base truncate">{log.description}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-gray-500 text-xs">{fmtDate(log.log_date)}</p>
                            {log.job_name && <p className="text-gray-600 text-xs truncate">· {log.job_name}</p>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-white font-semibold text-sm">{Number(log.miles).toFixed(1)} mi</p>
                          <p className="text-orange-400 font-bold text-sm">{fmt$(Number(log.deduction))}</p>
                        </div>
                        <button onClick={() => setConfirmDeleteId(log.id)}
                          className="text-red-400 w-10 h-10 flex items-center justify-center rounded-xl border border-[#2a2a2a] active:scale-95 shrink-0">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                            <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setConfirmDeleteId(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl px-5 pt-6 pb-10">
            <p className="text-white font-bold text-lg mb-1">Delete trip?</p>
            <p className="text-gray-400 text-sm mb-6">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteId(null)}
                className="flex-1 bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold py-4 rounded-xl active:scale-95">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 bg-red-600 text-white font-bold py-4 rounded-xl active:scale-95 disabled:opacity-50">
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
