"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createJob } from "@/app/actions/jobs";

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

export default function NewJobForm() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [photoNames, setPhotoNames] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement>(null);

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
    // Inject selected types since checkboxes are managed in state
    formData.delete("types");
    selectedTypes.forEach((t) => formData.append("types", t));

    const result = await createJob(formData);

    if (result.error) {
      setErrorMsg(result.error);
      setStatus("error");
    } else {
      router.push("/jobs");
    }
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setPhotoNames(files.map((f) => f.name));
  }

  return (
    <div className="min-h-screen bg-black px-4 py-8">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="mb-8">
          <p className="text-zinc-500 text-sm uppercase tracking-widest mb-1">Sightline</p>
          <h1 className="text-3xl font-bold text-white">New Job</h1>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Job Name */}
          <div className="flex flex-col gap-2">
            <label className="text-zinc-400 text-sm font-medium uppercase tracking-wider">
              Job Name
            </label>
            <input
              name="name"
              type="text"
              required
              placeholder="e.g. Johnson Kitchen Remodel"
              className="bg-zinc-900 border border-zinc-700 text-white text-lg rounded-xl px-4 py-4 placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors"
            />
          </div>

          {/* Job Type — multi-select checkboxes */}
          <div className="flex flex-col gap-3">
            <label className="text-zinc-400 text-sm font-medium uppercase tracking-wider">
              Job Type <span className="text-zinc-600 normal-case">(select all that apply)</span>
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
                        ? "bg-white text-black border-white font-semibold"
                        : "bg-zinc-900 text-white border-zinc-700"
                      }`}
                  >
                    <span className={`w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center
                      ${checked ? "bg-black border-black" : "border-zinc-500"}`}
                    >
                      {checked && (
                        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
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
            <label className="text-zinc-400 text-sm font-medium uppercase tracking-wider">
              Address
            </label>
            <input
              name="address"
              type="text"
              required
              placeholder="e.g. 123 Main St, Hillsboro, OR"
              className="bg-zinc-900 border border-zinc-700 text-white text-lg rounded-xl px-4 py-4 placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors"
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-2">
            <label className="text-zinc-400 text-sm font-medium uppercase tracking-wider">
              Notes
            </label>
            <textarea
              name="notes"
              rows={4}
              placeholder="Any details, scope of work, client info..."
              className="bg-zinc-900 border border-zinc-700 text-white text-lg rounded-xl px-4 py-4 placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors resize-none"
            />
          </div>

          {/* Photo Upload */}
          <div className="flex flex-col gap-2">
            <label className="text-zinc-400 text-sm font-medium uppercase tracking-wider">
              Photos
            </label>
            <label className="cursor-pointer bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-4 flex items-center justify-center gap-3 active:scale-95 transition-transform">
              <span className="text-2xl">📷</span>
              <span className="text-white text-lg font-medium">
                {photoNames.length > 0
                  ? `${photoNames.length} photo${photoNames.length > 1 ? "s" : ""} selected`
                  : "Upload Photos"}
              </span>
              <input
                name="photos"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotoChange}
              />
            </label>
            {photoNames.length > 0 && (
              <ul className="text-zinc-500 text-sm pl-1">
                {photoNames.map((n) => (
                  <li key={n} className="truncate">• {n}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Error */}
          {status === "error" && (
            <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-xl px-4 py-3">
              {errorMsg}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={status === "saving"}
            className="mt-2 bg-white text-black font-bold text-xl py-5 rounded-xl active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === "saving" ? "Saving..." : "Save Job"}
          </button>
        </form>
      </div>
    </div>
  );
}
