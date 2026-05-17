"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import TypeTags from "@/components/TypeTags";

type JobRow = {
  id: string;
  name: string;
  types: string[];
  address: string;
  status: string;
  updated_at: string;
  job_number: string | null;
  clientName: string | null;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active")
    return <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">Active</span>;
  if (status === "on_hold")
    return <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-[#2a2a2a] text-gray-400">On Hold</span>;
  return <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-green-900/30 text-green-400">Completed</span>;
}

export default function AllJobsClient({ jobs }: { jobs: JobRow[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "on_hold" | "completed">("all");

  const filtered = useMemo(() => {
    let list = jobs;
    if (filter !== "all") list = list.filter((j) => j.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (j) =>
          j.name.toLowerCase().includes(q) ||
          j.address.toLowerCase().includes(q) ||
          (j.clientName ?? "").toLowerCase().includes(q) ||
          (j.job_number ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [jobs, filter, search]);

  const active = filtered.filter((j) => j.status === "active");
  const onHold = filtered.filter((j) => j.status === "on_hold");
  const completed = filtered.filter((j) => j.status === "completed");

  if (jobs.length === 0) {
    return (
      <div className="text-center py-24">
        <p className="text-gray-400 text-lg mb-6">No jobs yet.</p>
        <Link
          href="/jobs/new"
          className="bg-orange-500 text-white font-bold text-lg px-8 py-4 rounded-xl active:scale-95 transition-transform inline-block"
        >
          Create Your First Job
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search jobs, clients, addresses…"
        className="w-full bg-[#1A1A1A] border border-[#2a2a2a] text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors mb-3"
      />

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {(["all", "active", "on_hold", "completed"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors capitalize ${
              filter === tab
                ? "bg-orange-500 text-white"
                : "bg-[#1A1A1A] border border-[#2a2a2a] text-gray-400"
            }`}
          >
            {tab === "on_hold" ? "On Hold" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab !== "all" && (
              <span className="ml-1 opacity-70">
                ({jobs.filter((j) => j.status === tab).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No jobs match your search.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {active.length > 0 && (
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">
                Active · {active.length}
              </p>
              <ul className="flex flex-col gap-3">
                {active.map((job) => <JobCard key={job.id} job={job} />)}
              </ul>
            </div>
          )}
          {onHold.length > 0 && (
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">
                On Hold · {onHold.length}
              </p>
              <ul className="flex flex-col gap-3">
                {onHold.map((job) => <JobCard key={job.id} job={job} />)}
              </ul>
            </div>
          )}
          {completed.length > 0 && (
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">
                Completed · {completed.length}
              </p>
              <ul className="flex flex-col gap-3">
                {completed.map((job) => <JobCard key={job.id} job={job} />)}
              </ul>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function JobCard({ job }: { job: JobRow }) {
  return (
    <li>
      <Link
        href={`/jobs/${job.id}`}
        className="block bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4 active:scale-95 transition-transform"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <h2 className="text-white font-bold text-lg leading-tight truncate">{job.name}</h2>
            {job.job_number && (
              <p className="text-gray-600 text-xs">#{job.job_number}</p>
            )}
          </div>
          <StatusBadge status={job.status} />
        </div>
        {job.clientName && (
          <p className="text-orange-400 text-sm font-semibold mb-2">{job.clientName}</p>
        )}
        <TypeTags types={job.types} />
        <div className="flex items-center justify-between mt-3">
          <p className="text-gray-400 text-sm truncate pr-4">{job.address}</p>
          <p className="text-gray-600 text-xs shrink-0">{formatDate(job.updated_at)}</p>
        </div>
      </Link>
    </li>
  );
}
