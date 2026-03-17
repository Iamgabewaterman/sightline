"use client";

import { useState, useTransition } from "react";
import { updateJobStatus } from "@/app/actions/jobs";
import { JobStatus } from "@/types";

const STATUSES: { value: JobStatus; label: string; description: string }[] = [
  { value: "active",    label: "Active",    description: "Job is in progress"    },
  { value: "on_hold",   label: "On Hold",   description: "Paused temporarily"    },
  { value: "completed", label: "Completed", description: "AI learns from this"   },
];

export default function JobStatusSelector({
  jobId,
  initialStatus,
  openPunchItems = 0,
}: {
  jobId: string;
  initialStatus: JobStatus;
  openPunchItems?: number;
}) {
  const [status, setStatus] = useState<JobStatus>(initialStatus);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [pendingNext, setPendingNext] = useState<JobStatus | null>(null);

  function handleChange(next: JobStatus) {
    if (next === status) return;
    // Warn if trying to complete with open punch list items
    if (next === "completed" && openPunchItems > 0) {
      setPendingNext(next);
      return;
    }
    applyChange(next);
  }

  function applyChange(next: JobStatus) {
    const prev = status;
    setStatus(next);
    setError("");
    setPendingNext(null);
    startTransition(async () => {
      const result = await updateJobStatus(jobId, next);
      if (result.error) {
        setStatus(prev);
        setError(result.error);
      }
    });
  }

  return (
    <>
      <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4">
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">
          Job Status
        </p>
        <div className="flex gap-2">
          {STATUSES.map(({ value, label, description }) => {
            const active = status === value;
            let activeStyle = "";
            if (active) {
              if (value === "completed") activeStyle = "bg-green-600 text-white border-green-600";
              else if (value === "active") activeStyle = "bg-orange-500 text-white border-orange-500";
              else activeStyle = "bg-[#2a2a2a] text-white border-[#333333]";
            }
            return (
              <button
                key={value}
                onClick={() => handleChange(value)}
                disabled={isPending}
                title={description}
                className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-colors active:scale-95 disabled:opacity-60 border
                  ${active
                    ? activeStyle
                    : "bg-[#242424] text-gray-400 border-[#2a2a2a]"
                  }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        {status === "completed" && (
          <p className="text-gray-400 text-xs mt-2">
            This job&apos;s materials data will train the estimator.
          </p>
        )}
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      </div>

      {/* Punch list warning sheet */}
      {pendingNext === "completed" && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setPendingNext(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl px-5 pt-6 pb-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EAB308" strokeWidth="2" strokeLinecap="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div>
                <p className="text-white font-bold text-lg leading-tight">Punch list not finished</p>
                <p className="text-yellow-400 text-sm">
                  {openPunchItems} unfinished item{openPunchItems !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-6">
              You still have {openPunchItems} unchecked punch list item{openPunchItems !== 1 ? "s" : ""}. Mark the job complete anyway?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingNext(null)}
                className="flex-1 bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold py-4 rounded-xl active:scale-95"
              >
                Go Back
              </button>
              <button
                onClick={() => applyChange("completed")}
                className="flex-1 bg-green-600 text-white font-bold py-4 rounded-xl active:scale-95"
              >
                Complete Anyway
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
