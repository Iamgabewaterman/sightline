"use client";

import { useState, useEffect, useRef } from "react";
import { useDriveContext } from "./DriveContext";
import { useClockContext } from "./ClockContext";
import { stopDrive, abandonActiveDrive } from "@/app/actions/drives";
import { useRouter } from "next/navigation";
import { Job } from "@/types";
import { IRS_RATE } from "@/lib/mileage-rate";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

function elapsedStr(startIso: string): string {
  const secs = Math.floor((Date.now() - new Date(startIso).getTime()) / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8; // miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getRoadDistance(
  startLat: number, startLng: number,
  endLat: number, endLng: number
): Promise<{ miles: number; isEstimated: boolean }> {
  if (!MAPBOX_TOKEN) {
    return { miles: Math.round(haversine(startLat, startLng, endLat, endLng) * 10) / 10, isEstimated: true };
  }
  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${startLng},${startLat};${endLng},${endLat}?access_token=${MAPBOX_TOKEN}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Mapbox error");
    const json = await res.json();
    const meters: number = json?.routes?.[0]?.distance;
    if (!meters) throw new Error("No route");
    return { miles: Math.round((meters / 1609.344) * 10) / 10, isEstimated: false };
  } catch {
    return { miles: Math.round(haversine(startLat, startLng, endLat, endLng) * 10) / 10, isEstimated: true };
  }
}

async function getGPS(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("GPS not supported")); return; }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
}

export default function DriveWidget() {
  const { activeDrive, setActiveDrive } = useDriveContext();
  const { activeSession } = useClockContext();
  const router = useRouter();

  // Live timer
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!activeDrive) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [activeDrive]);

  // Stop-drive flow state
  const [stopping, setStopping] = useState(false);
  const [gpsError, setGpsError] = useState("");

  // Post-stop quick-edit sheet
  const [editOpen, setEditOpen] = useState(false);
  const [editCategory, setEditCategory] = useState("work");
  const [editJobId, setEditJobId] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [pendingStop, setPendingStop] = useState<{
    driveId: string;
    endLat: number; endLng: number; endAccuracy: number | null;
    miles: number; isEstimated: boolean;
  } | null>(null);
  const [jobs, setJobs] = useState<Pick<Job, "id" | "name">[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [savedSummary, setSavedSummary] = useState<{ miles: number; deduction: number; isEstimated: boolean } | null>(null);

  // Abandon confirmation
  const [abandonOpen, setAbandonOpen] = useState(false);
  const [abandoning, setAbandoning] = useState(false);

  // Short drive warning
  const [shortDriveOpen, setShortDriveOpen] = useState(false);
  const shortDriveRef = useRef<{
    endLat: number; endLng: number; endAccuracy: number | null;
    miles: number; isEstimated: boolean;
  } | null>(null);

  // Low accuracy warning badge
  const lowAccuracy = (activeDrive?.start_accuracy ?? 0) > 100;

  useEffect(() => {
    if (!editOpen) return;
    // Fetch active jobs for the job selector
    import("@/app/actions/clock").then(({ getActiveJobs }) => {
      getActiveJobs().then((j) => setJobs(j as Pick<Job, "id" | "name">[]) );
    });
  }, [editOpen]);

  async function handleStop() {
    if (!activeDrive) return;
    setStopping(true);
    setGpsError("");
    try {
      const pos = await getGPS();
      const endLat = pos.coords.latitude;
      const endLng = pos.coords.longitude;
      const endAccuracy = pos.coords.accuracy ?? null;

      const { miles, isEstimated } = await getRoadDistance(
        activeDrive.start_lat, activeDrive.start_lng,
        endLat, endLng
      );

      if (miles < 0.1) {
        shortDriveRef.current = { endLat, endLng, endAccuracy, miles, isEstimated };
        setStopping(false);
        setShortDriveOpen(true);
        return;
      }

      openEditSheet(activeDrive.id, endLat, endLng, endAccuracy, miles, isEstimated);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "GPS unavailable";
      setGpsError(msg);
    } finally {
      setStopping(false);
    }
  }

  function openEditSheet(
    driveId: string,
    endLat: number, endLng: number, endAccuracy: number | null,
    miles: number, isEstimated: boolean
  ) {
    setPendingStop({ driveId, endLat, endLng, endAccuracy, miles, isEstimated });
    setEditCategory(activeDrive?.category ?? "work");
    setEditJobId(activeDrive?.job_id ?? "");
    setEditNotes("");
    setEditOpen(true);
  }

  async function handleSaveDrive() {
    if (!pendingStop) return;
    setSavingEdit(true);
    const res = await stopDrive(
      pendingStop.driveId,
      pendingStop.endLat, pendingStop.endLng, pendingStop.endAccuracy,
      pendingStop.miles, pendingStop.isEstimated,
      editCategory, editJobId || null, editNotes || null
    );
    setSavingEdit(false);
    if (res.error) { setGpsError(res.error); return; }

    setActiveDrive(null);
    setEditOpen(false);
    setPendingStop(null);
    setSavedSummary({
      miles: pendingStop.miles,
      deduction: Math.round(pendingStop.miles * IRS_RATE * 100) / 100,
      isEstimated: pendingStop.isEstimated,
    });
    router.refresh();
  }

  async function handleAbandon() {
    if (!activeDrive) return;
    setAbandoning(true);
    await abandonActiveDrive(activeDrive.id);
    setActiveDrive(null);
    setAbandonOpen(false);
    setAbandoning(false);
  }

  // Banner bottom offset — stack above clock widget if clock active
  const bannerBottom = activeSession
    ? "calc(56px + 40px + env(safe-area-inset-bottom))"
    : "calc(56px + env(safe-area-inset-bottom))";

  return (
    <>
      {/* Active drive banner */}
      {activeDrive && (
        <div
          className="fixed left-0 right-0 z-30 bg-[#1a3a1a] border-t border-green-800 flex items-center justify-between px-4 py-2"
          style={{ bottom: bannerBottom }}
        >
          <div className="flex flex-col leading-tight">
            <div className="flex items-center gap-2">
              <span className="text-green-400 font-bold text-sm">Drive in progress</span>
              {lowAccuracy && (
                <span className="text-yellow-400 text-xs">⚠ Low GPS</span>
              )}
            </div>
            <span className="text-green-300/80 text-xs font-mono">
              {elapsedStr(activeDrive.started_at)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAbandonOpen(true)}
              className="text-gray-400 text-xs px-2 py-1.5 rounded-lg border border-[#2a3a2a] active:opacity-70"
            >
              Cancel
            </button>
            <button
              onClick={handleStop}
              disabled={stopping}
              className="bg-green-500 text-white font-bold text-sm px-4 py-1.5 rounded-full active:opacity-70 disabled:opacity-50"
            >
              {stopping ? "Getting GPS…" : "Stop Drive"}
            </button>
          </div>
        </div>
      )}

      {/* GPS error toast */}
      {gpsError && activeDrive && (
        <div
          className="fixed left-4 right-4 z-40 bg-red-900/90 border border-red-700 rounded-xl px-4 py-3 text-red-200 text-sm"
          style={{ bottom: "calc(56px + 60px + env(safe-area-inset-bottom))" }}
        >
          GPS error: {gpsError}
          <button className="ml-3 text-red-400 font-bold" onClick={() => setGpsError("")}>✕</button>
        </div>
      )}

      {/* Short drive warning sheet */}
      {shortDriveOpen && shortDriveRef.current && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
          >
            <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mt-3 mb-5" />
            <div className="px-5">
              <p className="text-white font-bold text-lg mb-1">Short drive detected</p>
              <p className="text-gray-400 text-sm mb-6">
                Only {shortDriveRef.current.miles.toFixed(1)} miles detected — still save it?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShortDriveOpen(false);
                    shortDriveRef.current = null;
                  }}
                  className="flex-1 bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold py-4 rounded-xl active:scale-95"
                >
                  Discard
                </button>
                <button
                  onClick={() => {
                    if (!activeDrive || !shortDriveRef.current) return;
                    const s = shortDriveRef.current;
                    setShortDriveOpen(false);
                    openEditSheet(activeDrive.id, s.endLat, s.endLng, s.endAccuracy, s.miles, s.isEstimated);
                    shortDriveRef.current = null;
                  }}
                  className="flex-1 bg-green-600 text-white font-bold py-4 rounded-xl active:scale-95"
                >
                  Save Anyway
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Post-stop quick-edit sheet */}
      {editOpen && pendingStop && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
          >
            <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mt-3 mb-5" />
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest px-6 mb-1">Drive Complete</p>
            <div className="px-6 mb-4">
              <div className="flex items-center gap-2">
                <p className="text-white font-black text-2xl">{pendingStop.miles.toFixed(1)} mi</p>
                {pendingStop.isEstimated && (
                  <span className="text-yellow-500 text-xs border border-yellow-700 rounded px-1.5 py-0.5">est</span>
                )}
                <p className="text-orange-400 font-bold text-lg ml-auto">
                  ${(pendingStop.miles * IRS_RATE).toFixed(2)}
                </p>
              </div>
            </div>

            <div className="flex flex-col px-5 gap-4">
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

              {/* Job link */}
              {jobs.length > 0 && (
                <div>
                  <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-1.5">Link to Job (optional)</label>
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
                  placeholder="e.g. Home Depot run, client meeting"
                  className="w-full bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-orange-500"
                />
              </div>

              <button
                onClick={handleSaveDrive}
                disabled={savingEdit}
                className="w-full bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
              >
                {savingEdit ? "Saving…" : "Save Drive"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Abandon confirmation */}
      {abandonOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setAbandonOpen(false)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
          >
            <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mt-3 mb-5" />
            <div className="px-5">
              <p className="text-white font-bold text-lg mb-1">Cancel drive?</p>
              <p className="text-gray-400 text-sm mb-6">This drive will not be saved.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setAbandonOpen(false)}
                  className="flex-1 bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold py-4 rounded-xl active:scale-95"
                >
                  Keep Driving
                </button>
                <button
                  onClick={handleAbandon}
                  disabled={abandoning}
                  className="flex-1 bg-red-600 text-white font-bold py-4 rounded-xl active:scale-95 disabled:opacity-50"
                >
                  {abandoning ? "Cancelling…" : "Cancel Drive"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Saved summary */}
      {savedSummary && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setSavedSummary(null)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
          >
            <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mt-3 mb-5" />
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest px-6 mb-4">Drive Saved</p>
            <div className="flex flex-col px-5 gap-3">
              <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5 flex justify-between">
                <div className="text-center flex-1">
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-1">Miles</p>
                  <div className="flex items-center justify-center gap-1">
                    <p className="text-white font-black text-2xl">{savedSummary.miles.toFixed(1)}</p>
                    {savedSummary.isEstimated && (
                      <span className="text-yellow-500 text-xs border border-yellow-700 rounded px-1 py-0.5">est</span>
                    )}
                  </div>
                </div>
                <div className="w-px bg-[#2a2a2a]" />
                <div className="text-center flex-1">
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-1">Deduction</p>
                  <p className="text-orange-400 font-black text-2xl">${savedSummary.deduction.toFixed(2)}</p>
                </div>
              </div>
              <button
                onClick={() => setSavedSummary(null)}
                className="w-full bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform mt-1"
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
