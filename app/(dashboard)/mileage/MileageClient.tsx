"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Drive, Job } from "@/types";
import { useDriveContext } from "@/components/DriveContext";
import { startDrive, updateDrive, deleteDrive } from "@/app/actions/drives";
import { useRouter } from "next/navigation";
import { IRS_RATE } from "@/lib/mileage-rate";

function fmt$(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

async function getGPS(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("GPS not supported on this device")); return; }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
}

export default function MileageClient({
  initialDrives,
  jobs,
  irsRate,
}: {
  initialDrives: Drive[];
  jobs: Pick<Job, "id" | "name">[];
  irsRate: number;
}) {
  const { activeDrive, setActiveDrive } = useDriveContext();
  const router = useRouter();

  const [drives, setDrives] = useState<Drive[]>(initialDrives);
  useEffect(() => setDrives(initialDrives), [initialDrives]);

  const [starting, setStarting] = useState(false);
  const [gpsError, setGpsError] = useState("");

  // Edit sheet
  const [editDrive, setEditDrive] = useState<Drive | null>(null);
  const [editCategory, setEditCategory] = useState("work");
  const [editJobId, setEditJobId] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editMiles, setEditMiles] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete confirm
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Summary stats
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const ytdStart = new Date(now.getFullYear(), 0, 1);

  const workDrives = drives.filter((d) => d.category === "work");

  const weekMiles = workDrives
    .filter((d) => new Date(d.started_at) >= weekStart)
    .reduce((s, d) => s + Number(d.miles ?? 0), 0);

  const monthMiles = workDrives
    .filter((d) => new Date(d.started_at) >= monthStart)
    .reduce((s, d) => s + Number(d.miles ?? 0), 0);

  const ytdMiles = workDrives
    .filter((d) => new Date(d.started_at) >= ytdStart)
    .reduce((s, d) => s + Number(d.miles ?? 0), 0);

  const ytdDeduction = Math.round(ytdMiles * irsRate * 100) / 100;
  const weekDeduction = Math.round(weekMiles * irsRate * 100) / 100;
  const monthDeduction = Math.round(monthMiles * irsRate * 100) / 100;

  // Group by day
  const grouped = drives.reduce<Record<string, Drive[]>>((acc, d) => {
    const key = fmtDay(d.started_at);
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});

  async function handleStartDrive() {
    if (activeDrive) return;
    setStarting(true);
    setGpsError("");
    try {
      const pos = await getGPS();
      const res = await startDrive(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy ?? null);
      if (res.error) { setGpsError(res.error); return; }
      setActiveDrive(res.drive!);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not get GPS location";
      setGpsError(msg);
    } finally {
      setStarting(false);
    }
  }

  function openEdit(drive: Drive) {
    setEditDrive(drive);
    setEditCategory(drive.category ?? "work");
    setEditJobId(drive.job_id ?? "");
    setEditNotes(drive.notes ?? "");
    setEditMiles(String(drive.miles ?? ""));
  }

  async function handleSaveEdit() {
    if (!editDrive) return;
    setSavingEdit(true);
    const miles = parseFloat(editMiles);
    const res = await updateDrive(editDrive.id, {
      category: editCategory,
      job_id: editJobId || null,
      notes: editNotes || null,
      ...(isNaN(miles) ? {} : { miles }),
    });
    setSavingEdit(false);
    if (res.error) return;
    setDrives((prev) =>
      prev.map((d) =>
        d.id === editDrive.id
          ? { ...d, category: editCategory, job_id: editJobId || null, notes: editNotes || null, miles: isNaN(miles) ? d.miles : miles }
          : d
      )
    );
    setEditDrive(null);
  }

  async function handleDelete() {
    if (!confirmDeleteId) return;
    setDeleting(true);
    await deleteDrive(confirmDeleteId);
    setDrives((prev) => prev.filter((d) => d.id !== confirmDeleteId));
    setConfirmDeleteId(null);
    setDeleting(false);
  }

  function exportCSV() {
    const header = "Date,Miles,Estimated,Category,Job,Notes,Duration (min),Deduction\n";
    const rows = drives.map((d) =>
      [
        fmtDate(d.started_at),
        d.miles?.toFixed(1) ?? "",
        d.is_estimated ? "yes" : "no",
        d.category,
        d.job_name ?? "",
        (d.notes ?? "").replace(/,/g, ";"),
        d.duration_minutes ?? "",
        d.miles ? fmt$(Number(d.miles) * irsRate) : "",
      ].join(",")
    );
    const totalMiles = workDrives.reduce((s, d) => s + Number(d.miles ?? 0), 0);
    const footer = `\nTotals,,,,,,,"${fmt$(totalMiles * irsRate)}"`;
    const csv = header + rows.join("\n") + footer;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mileage-${now.getFullYear()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-8 pb-32">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/jobs" className="text-gray-400 text-2xl min-w-[48px] min-h-[48px] flex items-center justify-center active:scale-95">←</Link>
            <h1 className="text-3xl font-bold text-white">Mileage</h1>
          </div>
          <button
            onClick={exportCSV}
            className="text-gray-400 text-sm border border-[#2a2a2a] px-4 py-3 rounded-xl active:scale-95"
          >
            Export CSV
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-3 py-3 text-center">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">This Week</p>
            <p className="text-white font-black text-lg leading-none">{weekMiles.toFixed(1)}</p>
            <p className="text-orange-400 text-xs font-semibold mt-0.5">{fmt$(weekDeduction)}</p>
          </div>
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-3 py-3 text-center">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">This Month</p>
            <p className="text-white font-black text-lg leading-none">{monthMiles.toFixed(1)}</p>
            <p className="text-orange-400 text-xs font-semibold mt-0.5">{fmt$(monthDeduction)}</p>
          </div>
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-3 py-3 text-center">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">YTD</p>
            <p className="text-white font-black text-lg leading-none">{ytdMiles.toFixed(1)}</p>
            <p className="text-orange-400 text-xs font-semibold mt-0.5">{fmt$(ytdDeduction)}</p>
          </div>
        </div>
        <p className="text-gray-600 text-xs text-center mb-6">Work miles only · IRS rate ${irsRate}/mi ({now.getFullYear()})</p>

        {/* Start Drive button */}
        {!activeDrive && (
          <button
            onClick={handleStartDrive}
            disabled={starting}
            className="w-full bg-green-600 text-white font-bold text-base py-5 rounded-xl active:scale-95 transition-transform disabled:opacity-50 mb-6"
          >
            {starting ? "Getting GPS location…" : "▶  Start Drive"}
          </button>
        )}

        {activeDrive && (
          <div className="bg-[#1a3a1a] border border-green-800 rounded-xl px-5 py-4 mb-6 text-center">
            <p className="text-green-400 font-bold text-base">Drive in progress</p>
            <p className="text-green-300/70 text-sm mt-1">Use the banner above the tab bar to stop.</p>
          </div>
        )}

        {gpsError && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-3 mb-4 text-red-300 text-sm">
            {gpsError}
          </div>
        )}

        {/* Drive list */}
        {drives.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl py-16 text-center">
            <p className="text-gray-500 text-base mb-2">No drives yet</p>
            <p className="text-gray-600 text-sm">Hit Start Drive before your next trip.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {Object.entries(grouped).map(([day, dayDrives]) => {
              const dayMiles = dayDrives.reduce((s, d) => s + Number(d.miles ?? 0), 0);
              const dayWorkMiles = dayDrives
                .filter((d) => d.category === "work")
                .reduce((s, d) => s + Number(d.miles ?? 0), 0);
              return (
                <div key={day}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">{day}</p>
                    <p className="text-gray-500 text-xs">
                      {dayMiles.toFixed(1)} mi total
                      {dayWorkMiles > 0 && ` · ${fmt$(dayWorkMiles * irsRate)} deduction`}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {dayDrives.map((drive) => (
                      <button
                        key={drive.id}
                        onClick={() => openEdit(drive)}
                        className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 flex items-center gap-3 w-full text-left active:bg-[#222] transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-white font-semibold text-base">
                              {Number(drive.miles ?? 0).toFixed(1)} mi
                            </p>
                            {drive.is_estimated && (
                              <span className="text-yellow-500 text-xs border border-yellow-700 rounded px-1.5 py-0.5">est</span>
                            )}
                            {(drive.start_accuracy ?? 0) > 100 || (drive.end_accuracy ?? 0) > 100 ? (
                              <span className="text-yellow-400 text-xs">⚠ Low GPS</span>
                            ) : null}
                            <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${
                              drive.category === "work"
                                ? "text-orange-400 bg-orange-500/10"
                                : "text-gray-400 bg-[#2a2a2a]"
                            }`}>
                              {drive.category}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {drive.duration_minutes && (
                              <p className="text-gray-500 text-xs">{drive.duration_minutes} min</p>
                            )}
                            {drive.job_name && (
                              <p className="text-gray-600 text-xs truncate">· {drive.job_name}</p>
                            )}
                            {drive.notes && (
                              <p className="text-gray-600 text-xs truncate">· {drive.notes}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {drive.category === "work" && drive.miles && (
                            <p className="text-orange-400 font-bold text-sm">
                              {fmt$(Number(drive.miles) * irsRate)}
                            </p>
                          )}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto mt-1">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit sheet */}
      {editDrive && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setEditDrive(null)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
          >
            <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mt-3 mb-5" />
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest px-6 mb-1">Edit Drive</p>
            <p className="text-white font-bold text-xl px-6 mb-4">{Number(editDrive.miles ?? 0).toFixed(1)} mi · {fmtDate(editDrive.started_at)}</p>

            <div className="flex flex-col px-5 gap-4">
              {/* Miles override */}
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-1.5">Miles</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={editMiles}
                  onChange={(e) => setEditMiles(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-1.5">Category</label>
                <div className="flex gap-2">
                  {["work", "personal"].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setEditCategory(cat)}
                      className={`flex-1 py-3 rounded-xl border font-semibold text-sm active:scale-95 transition-transform capitalize ${
                        editCategory === cat
                          ? "border-orange-500 bg-orange-500/10 text-orange-400"
                          : "border-[#2a2a2a] bg-[#1A1A1A] text-gray-300"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Job */}
              {jobs.length > 0 && (
                <div>
                  <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-1.5">Job (optional)</label>
                  <select
                    value={editJobId}
                    onChange={(e) => setEditJobId(e.target.value)}
                    className="w-full bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-orange-500 appearance-none"
                  >
                    <option value="">No job</option>
                    {jobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
                  </select>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-1.5">Notes (optional)</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g. Home Depot run"
                  className="w-full bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-orange-500"
                />
              </div>

              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="w-full bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
              >
                {savingEdit ? "Saving…" : "Save Changes"}
              </button>

              <button
                onClick={() => { setEditDrive(null); setConfirmDeleteId(editDrive.id); }}
                className="w-full text-red-400 font-semibold text-base py-3"
              >
                Delete Drive
              </button>
            </div>
          </div>
        </>
      )}

      {/* Delete confirm */}
      {confirmDeleteId && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setConfirmDeleteId(null)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
          >
            <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mt-3 mb-5" />
            <div className="px-5">
              <p className="text-white font-bold text-lg mb-1">Delete drive?</p>
              <p className="text-gray-400 text-sm mb-6">This cannot be undone.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="flex-1 bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold py-4 rounded-xl active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 bg-red-600 text-white font-bold py-4 rounded-xl active:scale-95 disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
