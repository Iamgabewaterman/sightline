"use client";

import { useState, useRef } from "react";
import { createJob } from "@/app/actions/jobs";

const JOB_TYPES = [
  "Drywall",
  "Framing",
  "Plumbing",
  "Paint",
  "Trim",
  "Roofing",
  "Tile",
  "Flooring",
] as const;

export default function NewJobForm() {
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [photoNames, setPhotoNames] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("saving");
    setErrorMsg("");

    const formData = new FormData(e.currentTarget);
    const result = await createJob(formData);

    if (result.error) {
      setErrorMsg(result.error);
      setStatus("error");
    } else {
      setStatus("success");
      formRef.current?.reset();
      setPhotoNames([]);
    }
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setPhotoNames(files.map((f) => f.name));
  }

  if (status === "success") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-5xl mb-6">✓</div>
          <h2 className="text-2xl font-bold text-white mb-2">Job Saved</h2>
          <p className="text-zinc-400 mb-8">Your job has been created successfully.</p>
          <button
            onClick={() => setStatus("idle")}
            className="w-full bg-white text-black font-bold text-lg py-4 px-8 rounded-xl active:scale-95 transition-transform"
          >
            Create Another Job
          </button>
        </div>
      </div>
    );
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

          {/* Job Type */}
          <div className="flex flex-col gap-2">
            <label className="text-zinc-400 text-sm font-medium uppercase tracking-wider">
              Job Type
            </label>
            <select
              name="type"
              required
              defaultValue=""
              className="bg-zinc-900 border border-zinc-700 text-white text-lg rounded-xl px-4 py-4 focus:outline-none focus:border-white transition-colors appearance-none"
            >
              <option value="" disabled>
                Select a type...
              </option>
              {JOB_TYPES.map((t) => (
                <option key={t} value={t.toLowerCase()}>
                  {t}
                </option>
              ))}
            </select>
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
            <label className="cursor-pointer bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-4 flex items-center justify-center gap-3 active:scale-95 transition-transform hover:border-zinc-500">
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
