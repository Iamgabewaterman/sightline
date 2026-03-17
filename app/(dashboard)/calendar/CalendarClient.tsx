"use client";

import { useState, useTransition } from "react";
import {
  Assignment,
  getWeekAssignments,
  createAssignments,
  deleteAssignment,
  updateAssignmentNotes,
} from "@/app/actions/assignments";

// ── Helpers ───────────────────────────────────────────────────────────────

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_FULL  = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function isToday(iso: string): boolean {
  return iso === new Date().toISOString().slice(0, 10);
}

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

function fmtWeekRange(start: string): string {
  const end = addDays(start, 6);
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  if (s.getMonth() === e.getMonth()) return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
  return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()} – ${MONTH_NAMES[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
}

// ── Types ─────────────────────────────────────────────────────────────────

interface Props {
  role: "owner" | "field_member";
  initialWeekStart: string;
  initialAssignments: Assignment[];
  jobs: { id: string; name: string; address: string }[];
  members: { user_id: string; display_name: string | null }[];
}

// ── Main Component ────────────────────────────────────────────────────────

export default function CalendarClient({ role, initialWeekStart, initialAssignments, jobs, members }: Props) {
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [isPending, startTransition] = useTransition();

  // Assignment sheet state
  const [sheet, setSheet] = useState<"closed" | "assign" | "detail">("closed");
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const [detailAssignment, setDetailAssignment] = useState<Assignment | null>(null);

  // Assign form
  const [selJob, setSelJob] = useState("");
  const [selMembers, setSelMembers] = useState<string[]>([]);
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [assignNotes, setAssignNotes] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState("");

  // Detail edit
  const [editingNotes, setEditingNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function weekDays(): string[] {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }

  function assignmentsForDay(date: string): Assignment[] {
    return assignments.filter((a) => a.assigned_date === date);
  }

  async function loadWeek(start: string) {
    startTransition(async () => {
      const data = await getWeekAssignments(start);
      setAssignments(data);
    });
  }

  function goWeek(delta: number) {
    const next = addDays(weekStart, delta * 7);
    setWeekStart(next);
    loadWeek(next);
  }

  function openAssignSheet(date: string) {
    setSheetDate(date);
    setDateRangeStart(date);
    setDateRangeEnd(date);
    setSelJob("");
    setSelMembers([]);
    setAssignNotes("");
    setAssignError("");
    setSheet("assign");
  }

  function openDetailSheet(a: Assignment) {
    setDetailAssignment(a);
    setEditingNotes(a.notes ?? "");
    setSheet("detail");
  }

  function toggleMember(uid: string) {
    setSelMembers((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  }

  // Generate all dates in a range
  function datesInRange(start: string, end: string): string[] {
    const dates: string[] = [];
    let cur = start;
    while (cur <= end) {
      dates.push(cur);
      cur = addDays(cur, 1);
    }
    return dates;
  }

  async function handleAssign() {
    if (!selJob) { setAssignError("Select a job."); return; }
    if (selMembers.length === 0) { setAssignError("Select at least one crew member."); return; }
    setAssigning(true);
    setAssignError("");
    const dates = datesInRange(dateRangeStart, dateRangeEnd);
    const result = await createAssignments({ jobId: selJob, userIds: selMembers, dates, notes: assignNotes });
    if (result.error) {
      setAssignError(result.error);
    } else {
      await loadWeek(weekStart);
      setSheet("closed");
    }
    setAssigning(false);
  }

  async function handleSaveNotes() {
    if (!detailAssignment) return;
    setSavingNotes(true);
    await updateAssignmentNotes(detailAssignment.id, editingNotes);
    setAssignments((prev) => prev.map((a) => a.id === detailAssignment.id ? { ...a, notes: editingNotes } : a));
    setSavingNotes(false);
    setSheet("closed");
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await deleteAssignment(id);
    setAssignments((prev) => prev.filter((a) => a.id !== id));
    setDeletingId(null);
    setSheet("closed");
  }

  const days = weekDays();

  return (
    <div className="min-h-screen bg-[#0F0F0F] pb-16">
      {/* ── HEADER ── */}
      <div className="px-4 pt-8 pb-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-3xl font-bold text-white">Calendar</h1>
            <div className="flex items-center gap-1">
              <button
                onClick={() => goWeek(-1)}
                disabled={isPending}
                className="w-10 h-10 flex items-center justify-center bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl active:scale-95 transition-transform disabled:opacity-50"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <button
                onClick={() => { const ws = (() => { const d = new Date(); const day = d.getDay(); const diff = day === 0 ? -6 : 1 - day; d.setDate(d.getDate() + diff); return d.toISOString().slice(0, 10); })(); setWeekStart(ws); loadWeek(ws); }}
                className="px-3 h-10 bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl text-gray-400 text-xs font-semibold active:scale-95 transition-transform"
              >
                Today
              </button>
              <button
                onClick={() => goWeek(1)}
                disabled={isPending}
                className="w-10 h-10 flex items-center justify-center bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl active:scale-95 transition-transform disabled:opacity-50"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
          </div>
          <p className="text-gray-500 text-sm">{fmtWeekRange(weekStart)}</p>
        </div>
      </div>

      {/* ── WEEK GRID ── */}
      <div className="px-4 max-w-lg mx-auto flex flex-col gap-2">
        {days.map((date, i) => {
          const dayAssignments = assignmentsForDay(date);
          const today = isToday(date);

          return (
            <div
              key={date}
              className={`rounded-xl border ${today ? "border-orange-500/50 bg-orange-500/5" : "border-[#2a2a2a] bg-[#1A1A1A]"}`}
            >
              {/* Day header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a]">
                <div className="flex items-center gap-2">
                  <span className={`font-bold text-sm ${today ? "text-orange-500" : "text-gray-400"}`}>{DAY_NAMES[i]}</span>
                  <span className={`text-sm ${today ? "text-orange-400 font-semibold" : "text-gray-500"}`}>{fmtDate(date)}</span>
                  {today && <span className="text-[10px] font-bold text-orange-500 bg-orange-500/15 px-1.5 py-0.5 rounded-full">TODAY</span>}
                </div>
                {role === "owner" && (
                  <button
                    onClick={() => openAssignSheet(date)}
                    className="text-orange-500 text-xs font-bold bg-orange-500/10 border border-orange-500/20 px-3 py-1.5 rounded-lg active:scale-95 transition-transform"
                  >
                    + Assign
                  </button>
                )}
              </div>

              {/* Assignments for this day */}
              <div className="px-3 py-2 flex flex-col gap-1.5">
                {dayAssignments.length === 0 ? (
                  <p className="text-gray-600 text-xs py-1">No assignments</p>
                ) : (
                  dayAssignments.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => openDetailSheet(a)}
                      className="w-full text-left bg-[#242424] border border-[#333] rounded-lg px-3 py-2.5 active:scale-95 transition-transform"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-white font-semibold text-sm truncate">{a.job_name}</p>
                          {a.job_address && <p className="text-gray-500 text-xs truncate">{a.job_address}</p>}
                          {role === "owner" && a.member_name && (
                            <p className="text-orange-400 text-xs mt-0.5">{a.member_name}</p>
                          )}
                          {a.notes && <p className="text-gray-400 text-xs mt-0.5 italic">{a.notes}</p>}
                        </div>
                        <svg className="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── ASSIGN SHEET ── */}
      {sheet === "assign" && (
        <>
          <div className="fixed inset-0 z-50 bg-black/70" onClick={() => setSheet("closed")} />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl overflow-y-auto"
            style={{ maxHeight: "85vh", paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
          >
            <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mt-3 mb-4" />
            <div className="px-5">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">Assign Job</p>
              <p className="text-white font-bold text-lg mb-4">
                {sheetDate ? DAY_FULL[new Date(sheetDate + "T00:00:00").getDay() === 0 ? 6 : new Date(sheetDate + "T00:00:00").getDay() - 1] + ", " + fmtDate(sheetDate) : ""}
              </p>

              {/* Job picker */}
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Job</p>
              <div className="flex flex-col gap-1.5 mb-4">
                {jobs.length === 0 && <p className="text-gray-500 text-sm">No active jobs.</p>}
                {jobs.map((j) => (
                  <button
                    key={j.id}
                    onClick={() => setSelJob(j.id)}
                    className={`text-left px-4 py-3 rounded-xl border transition-colors active:scale-95 ${selJob === j.id ? "bg-orange-500/15 border-orange-500/50 text-white" : "bg-[#1A1A1A] border-[#2a2a2a] text-gray-300"}`}
                  >
                    <p className="font-semibold text-sm">{j.name}</p>
                    {j.address && <p className="text-gray-500 text-xs">{j.address}</p>}
                  </button>
                ))}
              </div>

              {/* Crew picker */}
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Crew Members</p>
              {members.length === 0 ? (
                <p className="text-gray-500 text-sm mb-4">No field members on your team yet.</p>
              ) : (
                <div className="flex flex-col gap-1.5 mb-4">
                  {members.map((m) => {
                    const checked = selMembers.includes(m.user_id);
                    return (
                      <button
                        key={m.user_id}
                        onClick={() => toggleMember(m.user_id)}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors active:scale-95 ${checked ? "bg-orange-500/15 border-orange-500/50" : "bg-[#1A1A1A] border-[#2a2a2a]"}`}
                      >
                        <span className={`font-semibold text-sm ${checked ? "text-white" : "text-gray-300"}`}>
                          {m.display_name ?? `Member ${m.user_id.slice(0, 6)}`}
                        </span>
                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${checked ? "bg-orange-500 border-orange-500" : "border-[#444]"}`}>
                          {checked && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Date range */}
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Date Range</p>
              <div className="flex gap-2 mb-4">
                <div className="flex-1">
                  <p className="text-gray-500 text-xs mb-1">Start</p>
                  <input
                    type="date"
                    value={dateRangeStart}
                    onChange={(e) => { setDateRangeStart(e.target.value); if (e.target.value > dateRangeEnd) setDateRangeEnd(e.target.value); }}
                    className="w-full bg-[#1A1A1A] border border-[#2a2a2a] text-white rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-gray-500 text-xs mb-1">End</p>
                  <input
                    type="date"
                    value={dateRangeEnd}
                    min={dateRangeStart}
                    onChange={(e) => setDateRangeEnd(e.target.value)}
                    className="w-full bg-[#1A1A1A] border border-[#2a2a2a] text-white rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Instructions / Notes</p>
              <textarea
                value={assignNotes}
                onChange={(e) => setAssignNotes(e.target.value)}
                placeholder="What to bring, access info, special instructions..."
                rows={3}
                className="w-full bg-[#1A1A1A] border border-[#2a2a2a] text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-600 focus:outline-none focus:border-orange-500 resize-none mb-4"
              />

              {assignError && (
                <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-xl px-4 py-3 mb-4">{assignError}</p>
              )}

              <button
                onClick={handleAssign}
                disabled={assigning}
                className="w-full bg-orange-500 text-white font-bold text-lg py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50 mb-3"
              >
                {assigning ? "Saving..." : "Assign"}
              </button>
              <button onClick={() => setSheet("closed")} className="w-full bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold text-lg py-4 rounded-xl active:scale-95 transition-transform">
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── DETAIL / EDIT SHEET ── */}
      {sheet === "detail" && detailAssignment && (
        <>
          <div className="fixed inset-0 z-50 bg-black/70" onClick={() => setSheet("closed")} />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl overflow-y-auto"
            style={{ maxHeight: "75vh", paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
          >
            <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mt-3 mb-4" />
            <div className="px-5 flex flex-col gap-4">
              <div>
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">Assignment</p>
                <p className="text-white font-bold text-xl">{detailAssignment.job_name}</p>
                {detailAssignment.job_address && <p className="text-gray-400 text-sm">{detailAssignment.job_address}</p>}
                <p className="text-gray-500 text-xs mt-1">{fmtDate(detailAssignment.assigned_date)}</p>
                {role === "owner" && detailAssignment.member_name && (
                  <p className="text-orange-400 text-sm mt-1">{detailAssignment.member_name}</p>
                )}
              </div>

              {/* Lockbox (field member view) */}
              {role === "field_member" && detailAssignment.job_lockbox && (
                <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-3">
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">Lockbox Code</p>
                  <p className="text-orange-500 font-mono text-2xl font-bold tracking-widest">{detailAssignment.job_lockbox}</p>
                </div>
              )}

              {/* Notes */}
              <div>
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  {role === "owner" ? "Instructions / Notes" : "Instructions from your employer"}
                </p>
                {role === "owner" ? (
                  <textarea
                    value={editingNotes}
                    onChange={(e) => setEditingNotes(e.target.value)}
                    placeholder="Instructions, what to bring, access info..."
                    rows={3}
                    className="w-full bg-[#1A1A1A] border border-[#2a2a2a] text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-600 focus:outline-none focus:border-orange-500 resize-none"
                  />
                ) : (
                  <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-3">
                    {detailAssignment.notes
                      ? <p className="text-white text-sm">{detailAssignment.notes}</p>
                      : <p className="text-gray-500 text-sm italic">No instructions added.</p>
                    }
                  </div>
                )}
              </div>

              {role === "owner" && (
                <>
                  <button
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="w-full bg-orange-500 text-white font-bold text-lg py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
                  >
                    {savingNotes ? "Saving..." : "Save Notes"}
                  </button>
                  <button
                    onClick={() => handleDelete(detailAssignment.id)}
                    disabled={deletingId === detailAssignment.id}
                    className="w-full bg-red-950/50 border border-red-900/50 text-red-400 font-semibold text-lg py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
                  >
                    {deletingId === detailAssignment.id ? "Removing..." : "Remove Assignment"}
                  </button>
                </>
              )}

              <button onClick={() => setSheet("closed")} className="w-full bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold text-lg py-4 rounded-xl active:scale-95 transition-transform">
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
