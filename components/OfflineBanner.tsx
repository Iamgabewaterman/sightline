"use client";

import { useState, useEffect, useCallback } from "react";
import { getQueue, clearQueue, type QueuedAction } from "@/hooks/useOfflineQueue";
import { togglePunchListItem } from "@/app/actions/punch-list";
import { addLaborLog } from "@/app/actions/labor";
import { addDailyLog } from "@/app/actions/daily-logs";

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  const syncQueue = useCallback(async () => {
    const queue = getQueue();
    if (queue.length === 0) return;

    let synced = 0;
    const failed: QueuedAction[] = [];

    for (const item of queue) {
      try {
        const { action } = item;

        if (action.type === "toggle_punch") {
          await togglePunchListItem(action.payload.itemId, action.payload.completed);
          synced++;
        } else if (action.type === "add_labor") {
          const fd = new FormData();
          fd.set("crew_name", action.payload.crew_name);
          fd.set("hours", action.payload.hours);
          fd.set("rate", action.payload.rate);
          const res = await addLaborLog(action.payload.jobId, fd);
          if (res.error) failed.push(item);
          else synced++;
        } else if (action.type === "add_daily_log") {
          const res = await addDailyLog(
            action.payload.jobId,
            action.payload.date,
            action.payload.notes,
            action.payload.crew
          );
          if (res.error) failed.push(item);
          else synced++;
        } else {
          // Unknown type — keep in queue
          failed.push(item);
        }
      } catch {
        failed.push(item);
      }
    }

    if (failed.length === 0) {
      clearQueue();
    } else {
      localStorage.setItem("sightline_offline_queue", JSON.stringify(failed));
    }

    if (synced > 0) {
      setSyncToast(`${synced} item${synced !== 1 ? "s" : ""} synced`);
      setTimeout(() => setSyncToast(null), 3500);
    }
  }, []);

  useEffect(() => {
    // Set initial state
    setIsOffline(!navigator.onLine);

    function handleOffline() {
      setIsOffline(true);
    }

    function handleOnline() {
      setIsOffline(false);
      syncQueue();
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [syncQueue]);

  return (
    <>
      {/* Offline banner */}
      {isOffline && (
        <div
          className="fixed top-0 left-0 right-0 z-[100] bg-orange-500 text-white text-center text-sm font-semibold py-2 px-4"
          style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
        >
          Offline — viewing cached data
        </div>
      )}

      {/* Sync toast */}
      {syncToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] bg-[#1A1A1A] border border-green-500/40 text-green-400 font-semibold text-sm px-5 py-3 rounded-2xl shadow-xl whitespace-nowrap">
          ✓ {syncToast}
        </div>
      )}
    </>
  );
}
