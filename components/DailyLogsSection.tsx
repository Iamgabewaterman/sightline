"use client";

import { useState } from "react";
import { DailyLog } from "@/types";
import { addDailyLog, deleteDailyLog } from "@/app/actions/daily-logs";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso: string) {
  // Parse as local date to avoid UTC-shift display issues
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

export default function DailyLogsSection({
  jobId,
  initialLogs,
}: {
  jobId: string;
  initialLogs: DailyLog[];
}) {
  const [logs, setLogs] = useState<DailyLog[]>(initialLogs);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [logDate, setLogDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [crewPresent, setCrewPresent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function openSheet() {
    setLogDate(today());
    setNotes("");
    setCrewPresent("");
    setError("");
    setSheetOpen(true);
  }

  async function handleAdd() {
    setSaving(true);
    setError("");
    const res = await addDailyLog(jobId, logDate, notes, crewPresent);
    setSaving(false);
    if (res.error) { setError(res.error); return; }
    setLogs((prev) => [res.log!, ...prev].sort((a, b) => {
      if (b.log_date !== a.log_date) return b.log_date.localeCompare(a.log_date);
      return b.created_at.localeCompare(a.created_at);
    }));
    setSheetOpen(false);
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    await deleteDailyLog(id);
    setLogs((prev) => prev.filter((l) => l.id !== id));
    setConfirmDeleteId(null);
    setDeleting(false);
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white font-bold text-lg">Daily Logs</h2>
        <button
          onClick={openSheet}
          className="flex items-center gap-1.5 text-orange-400 font-semibold text-sm active:opacity-70 min-h-[44px] px-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Log
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl py-10 text-center">
          <p className="text-gray-500 text-sm">No logs yet. Tap Add Log to record daily progress.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {logs.map((log) => (
            <div key={log.id} className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <span className="text-orange-400 font-semibold text-sm">{fmtDate(log.log_date)}</span>
                <button
                  onClick={() => setConfirmDeleteId(log.id)}
                  className="text-gray-600 active:text-red-400 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 -mt-1"
                  aria-label="Delete log"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                  </svg>
                </button>
              </div>
              {log.crew_present && (
                <p className="text-gray-400 text-xs mt-1">
                  <span className="text-gray-500">Crew:</span> {log.crew_present}
                </p>
              )}
              {log.notes && (
                <p className="text-white text-sm mt-2 whitespace-pre-wrap leading-relaxed">{log.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Add log sheet ── */}
      {sheetOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setSheetOpen(false)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
          >
            <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mt-3 mb-5" />
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest px-6 mb-4">Add Daily Log</p>
            <div className="flex flex-col px-5 gap-4">
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-1.5">Date</label>
                <input
                  type="date"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-1.5">Crew Present</label>
                <input
                  type="text"
                  value={crewPresent}
                  onChange={(e) => setCrewPresent(e.target.value)}
                  placeholder="e.g. Gabe, Mike"
                  className="w-full bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-1.5">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What was done today..."
                  rows={4}
                  className="w-full bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-orange-500 resize-none"
                />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                onClick={handleAdd}
                disabled={saving}
                className="w-full bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Log"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Delete confirm sheet ── */}
      {confirmDeleteId && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setConfirmDeleteId(null)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
          >
            <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mt-3 mb-5" />
            <div className="px-5 pb-2">
              <p className="text-white font-bold text-lg mb-1">Delete this log?</p>
              <p className="text-gray-400 text-sm mb-6">This can't be undone.</p>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={deleting}
                className="w-full bg-red-600 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50 mb-3"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="w-full text-gray-400 font-semibold text-base py-3"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
