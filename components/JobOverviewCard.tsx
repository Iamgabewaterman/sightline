"use client";

import { useState } from "react";
import Link from "next/link";
import { Job } from "@/types";
import TypeTags from "@/components/TypeTags";
import JobStatus from "@/components/JobStatus";
import LockboxCode from "@/components/LockboxCode";
import TimelineSection from "@/components/TimelineSection";
import DimensionsSection from "@/components/DimensionsSection";

const TYPE_LABELS: Record<string, string> = {
  drywall: "Drywall", framing: "Framing", plumbing: "Plumbing",
  paint: "Paint", trim: "Trim", roofing: "Roofing", tile: "Tile",
  flooring: "Flooring", electrical: "Electrical", hvac: "HVAC",
  concrete: "Concrete", landscaping: "Landscaping",
  decks_patios: "Decks", fencing: "Fencing",
};

function StatusDot({ status }: { status: string }) {
  const dot: Record<string, string> = {
    active: "bg-orange-500",
    on_hold: "bg-gray-400",
    completed: "bg-green-500",
  };
  const label: Record<string, string> = {
    active: "Active", on_hold: "On Hold", completed: "Complete",
  };
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className={`w-2 h-2 rounded-full ${dot[status] ?? "bg-gray-400"}`} />
      <span className="text-gray-300 text-xs font-medium">{label[status] ?? status}</span>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

export default function JobOverviewCard({
  job,
  jobClient,
  openPunchItems,
  hasInvoice,
  timelineInsight,
}: {
  job: Job;
  jobClient: { id: string; name: string } | null;
  openPunchItems: number;
  hasInvoice: boolean;
  timelineInsight: { min: number; max: number; type: string } | null;
}) {
  const [open, setOpen] = useState(false);

  const firstType = job.types?.[0];

  return (
    <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
      {/* Collapsed row */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 min-h-[48px] py-3 active:opacity-70 transition-opacity text-left"
        aria-expanded={open}
      >
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <span className="text-white font-bold text-base leading-tight truncate">{job.name}</span>
          {job.job_number && (
            <span className="text-gray-500 text-xs shrink-0">#{job.job_number}</span>
          )}
          <StatusDot status={job.status ?? "active"} />
          {firstType && (
            <span className="text-xs font-semibold uppercase tracking-wider text-white bg-[#292929] px-2 py-0.5 rounded-full shrink-0">
              {TYPE_LABELS[firstType] ?? firstType}
            </span>
          )}
        </div>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="text-gray-500 shrink-0"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.18s ease" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expanded content */}
      <div className={open ? "" : "hidden"}>
        <div className="border-t border-[#2a2a2a] px-4 pt-4 pb-4 flex flex-col gap-4">
          {/* Client link */}
          {jobClient && (
            <Link
              href={`/clients/${jobClient.id}`}
              className="flex items-center gap-2 text-orange-400 active:opacity-70"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              </svg>
              <span className="text-sm font-semibold">{jobClient.name}</span>
            </Link>
          )}

          {/* Status buttons */}
          <JobStatus
            jobId={job.id}
            initialStatus={job.status ?? "active"}
            openPunchItems={openPunchItems}
            hasInvoice={hasInvoice}
          />

          {/* Job types */}
          <div>
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Job Type</p>
            <TypeTags types={job.types} />
          </div>

          {/* Address */}
          {job.address && (
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">Address</p>
              <p className="text-white text-base">{job.address}</p>
            </div>
          )}

          {/* Est. completion */}
          {job.estimated_completion_date && (
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">Est. Completion</p>
              <p className="text-white text-base">{formatDate(job.estimated_completion_date)}</p>
            </div>
          )}

          {/* Notes */}
          {job.notes && (
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">Notes</p>
              <p className="text-white text-base whitespace-pre-wrap">{job.notes}</p>
            </div>
          )}

          {/* Lockbox */}
          {job.lockbox_code && <LockboxCode code={job.lockbox_code} />}

          {/* Timeline */}
          <TimelineSection job={job} timelineInsight={timelineInsight} />

          {/* Dimensions */}
          <DimensionsSection
            jobId={job.id}
            initialLength={job.dim_length ?? null}
            initialWidth={job.dim_width ?? null}
            initialHeight={job.dim_height ?? null}
            initialSqft={job.calculated_sqft ?? null}
          />
        </div>
      </div>
    </div>
  );
}
