"use client";

import { useState, useTransition } from "react";
import { updateJobStatus } from "@/app/actions/jobs";
import { JobStatus } from "@/types";

const STATUSES: { value: JobStatus; label: string; description: string }[] = [
  { value: "active", label: "Active", description: "Job is in progress" },
  { value: "on_hold", label: "On Hold", description: "Paused temporarily" },
  { value: "completed", label: "Completed", description: "AI learns from this" },
];

export default function JobStatusSelector({
  jobId,
  initialStatus,
}: {
  jobId: string;
  initialStatus: JobStatus;
}) {
  const [status, setStatus] = useState<JobStatus>(initialStatus);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleChange(next: JobStatus) {
    if (next === status) return;
    const prev = status;
    setStatus(next);
    setError("");
    startTransition(async () => {
      const result = await updateJobStatus(jobId, next);
      if (result.error) {
        setStatus(prev);
        setError(result.error);
      }
    });
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl px-5 py-4">
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
            else activeStyle = "bg-gray-600 text-white border-gray-600";
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
                  : "bg-gray-700 text-gray-400 border-gray-700"
                }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      {status === "completed" && (
        <p className="text-gray-400 text-xs mt-2">
          This job's materials data will train the estimator.
        </p>
      )}
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  );
}
