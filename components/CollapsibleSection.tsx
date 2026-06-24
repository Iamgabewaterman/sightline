"use client";

import { useState, useEffect } from "react";
import { useJobCost } from "@/components/JobCostContext";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-gray-500 shrink-0"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.18s ease" }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default function CollapsibleSection({
  title,
  count,
  accentCount,
  children,
  defaultOpen = false,
  sectionId,
}: {
  title: string;
  count?: number;
  accentCount?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
  /** When set, a quick-action requestOpen(sectionId) expands this section. */
  sectionId?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { openRequests } = useJobCost();
  const signal = sectionId ? openRequests[sectionId] : undefined;

  useEffect(() => {
    if (signal) setOpen(true);
  }, [signal]);

  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between min-h-[48px] py-2 active:opacity-70 transition-opacity"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-white font-bold text-lg leading-tight">{title}</span>
          {accentCount !== undefined && accentCount > 0 && (
            <span className="text-xs font-bold bg-orange-500 text-white px-2 py-0.5 rounded-full min-w-[1.5rem] text-center tabular-nums">
              {accentCount}
            </span>
          )}
          {count !== undefined && (accentCount === undefined || accentCount === 0) && (
            <span className="text-xs font-bold text-gray-500 bg-[#222] border border-[#2a2a2a] px-2 py-0.5 rounded-full min-w-[1.5rem] text-center tabular-nums">
              {count}
            </span>
          )}
        </div>
        <ChevronIcon open={open} />
      </button>
      <div className={open ? "" : "hidden"}>
        {children}
      </div>
    </div>
  );
}
