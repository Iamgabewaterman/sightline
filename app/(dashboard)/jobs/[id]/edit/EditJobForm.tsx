"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateJob } from "@/app/actions/jobs";
import { Job } from "@/types";

const JOB_TYPES = [
  { value: "drywall", label: "Drywall" },
  { value: "framing", label: "Framing" },
  { value: "plumbing", label: "Plumbing" },
  { value: "paint", label: "Paint" },
  { value: "trim", label: "Trim" },
  { value: "roofing", label: "Roofing" },
  { value: "tile", label: "Tile" },
  { value: "flooring", label: "Flooring" },
  { value: "electrical", label: "Electrical" },
  { value: "hvac", label: "HVAC" },
  { value: "concrete", label: "Concrete" },
  { value: "landscaping", label: "Landscaping" },
];

export default function EditJobForm({ job }: { job: Job }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(job.types ?? []);

  function toggleType(value: string) {
    setSelectedTypes((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (selectedTypes.length === 0) {
      setErrorMsg("Select at least one job type.");
      setStatus("error");
      return;
    }
    setStatus("saving");
    setErrorMsg("");

    const formData = new FormData(e.currentTarget);
    formData.delete("types");
    selectedTypes.forEach((t) => formData.append("types", t));

    const result = await updateJob(job.id, formData);

    if (result.error) {
      setErrorMsg(result.error);
      setStatus("error");
    } else {
      router.push(`/jobs/${job.id}`);
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-8">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="mb-8">
          <p className="text-gray-400 text-sm uppercase tracking-widest mb-1">Editing</p>
          <h1 className="text-3xl font-bold text-white">{job.name}</h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Job Name */}
          <div className="flex flex-col gap-2">
            <label className="text-gray-400 text-sm font-medium uppercase tracking-wider">
              Job Name
            </label>
            <input
              name="name"
              type="text"
              required
              defaultValue={job.name}
              className="bg-[#1A1A1A] border border-[#2a2a2a] text-white text-lg rounded-xl px-4 py-4 placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          {/* Job Types */}
          <div className="flex flex-col gap-3">
            <label className="text-gray-400 text-sm font-medium uppercase tracking-wider">
              Job Type <span className="text-gray-500 normal-case">(select all that apply)</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {JOB_TYPES.map(({ value, label }) => {
                const checked = selectedTypes.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleType(value)}
                    className={`flex items-center gap-3 px-4 py-4 rounded-xl border text-left transition-colors active:scale-95
                      ${checked
                        ? "bg-orange-500 text-white border-orange-500 font-semibold"
                        : "bg-[#1A1A1A] text-white border-[#2a2a2a]"
                      }`}
                  >
                    <span className={`w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center
                      ${checked ? "bg-white border-white" : "border-gray-500"}`}
                    >
                      {checked && (
                        <svg className="w-3 h-3 text-orange-500" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <span className="text-base">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Address */}
          <div className="flex flex-col gap-2">
            <label className="text-gray-400 text-sm font-medium uppercase tracking-wider">
              Address
            </label>
            <input
              name="address"
              type="text"
              required
              defaultValue={job.address}
              className="bg-[#1A1A1A] border border-[#2a2a2a] text-white text-lg rounded-xl px-4 py-4 placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-2">
            <label className="text-gray-400 text-sm font-medium uppercase tracking-wider">
              Notes
            </label>
            <textarea
              name="notes"
              rows={4}
              defaultValue={job.notes ?? ""}
              placeholder="Any details, scope of work, client info..."
              className="bg-[#1A1A1A] border border-[#2a2a2a] text-white text-lg rounded-xl px-4 py-4 placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors resize-none"
            />
          </div>

          {/* Lockbox Code */}
          <div className="flex flex-col gap-2">
            <label className="text-gray-400 text-sm font-medium uppercase tracking-wider">
              Lockbox Code <span className="text-gray-500 normal-case">(optional)</span>
            </label>
            <input
              name="lockbox_code"
              type="text"
              defaultValue={job.lockbox_code ?? ""}
              placeholder="e.g. 4829 or B#7712"
              autoComplete="off"
              className="bg-[#1A1A1A] border border-[#2a2a2a] text-white text-lg rounded-xl px-4 py-4 placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          {/* Error */}
          {status === "error" && (
            <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-xl px-4 py-3">
              {errorMsg}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3 mt-2">
            <button
              type="submit"
              disabled={status === "saving"}
              className="bg-orange-500 text-white font-bold text-xl py-5 rounded-xl active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === "saving" ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              disabled={status === "saving"}
              className="bg-[#1A1A1A] text-white font-semibold text-lg py-5 rounded-xl border border-[#2a2a2a] active:scale-95 transition-transform disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
