"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createJob } from "@/app/actions/jobs";
import { applyTemplateToJob } from "@/app/actions/templates";
import ClientSelector from "@/components/ClientSelector";

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
  { value: "decks_patios", label: "Decks & Patios" },
  { value: "fencing",      label: "Fencing" },
];

const TYPE_LABEL: Record<string, string> = Object.fromEntries(JOB_TYPES.map((t) => [t.value, t.label]));

interface Template {
  id: string;
  name: string;
  job_types: string[];
  materials: { name: string; unit: string }[];
  punch_list_items: string[];
}

export default function NewJobForm({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [status, setStatus]             = useState<"idle" | "saving" | "error">("idle");
  const [errorMsg, setErrorMsg]         = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [photoNames, setPhotoNames]     = useState<string[]>([]);
  const [clientId, setClientId]         = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateSheetOpen, setTemplateSheetOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function toggleType(value: string) {
    setSelectedTypes((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
    );
  }

  function pickTemplate(t: Template) {
    setSelectedTemplate(t);
    // Pre-fill job types from template
    setSelectedTypes(t.job_types);
    setTemplateSheetOpen(false);
  }

  function clearTemplate() {
    setSelectedTemplate(null);
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
    if (clientId) formData.set("client_id", clientId);

    const result = await createJob(formData);

    if (result.error) {
      setErrorMsg(result.error);
      setStatus("error");
      return;
    }

    // Apply template if one was selected
    if (selectedTemplate && result.jobId) {
      await applyTemplateToJob(result.jobId, selectedTemplate.id);
    }

    router.push(result.jobId ? `/jobs/${result.jobId}` : "/jobs");
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setPhotoNames(files.map((f) => f.name));
  }

  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-8">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="mb-8">
          <p className="text-gray-400 text-sm uppercase tracking-widest mb-1">Sightline</p>
          <h1 className="text-3xl font-bold text-white">New Job</h1>
        </div>

        {/* Template picker */}
        {templates.length > 0 && (
          <div className="mb-6">
            {selectedTemplate ? (
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-orange-400 text-xs font-bold uppercase tracking-wider mb-0.5">Template applied</p>
                  <p className="text-white font-semibold text-sm">{selectedTemplate.name}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {selectedTemplate.materials.length} materials · {selectedTemplate.punch_list_items.length} punch list items will be added
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearTemplate}
                  className="text-gray-500 text-xs font-semibold active:text-white ml-4 min-h-[44px] px-2"
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setTemplateSheetOpen(true)}
                className="w-full flex items-center justify-between bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 active:scale-95 transition-transform"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-orange-500/15 flex items-center justify-center shrink-0">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <line x1="9" y1="9" x2="15" y2="9"/>
                      <line x1="9" y1="13" x2="15" y2="13"/>
                      <line x1="9" y1="17" x2="12" y2="17"/>
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-white font-semibold text-sm">Start from a template</p>
                    <p className="text-gray-500 text-xs">{templates.length} template{templates.length !== 1 ? "s" : ""} available</p>
                  </div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            )}
          </div>
        )}

        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Client */}
          <ClientSelector
            selectedClientId={clientId}
            onChange={(id) => setClientId(id)}
          />

          {/* Job Name */}
          <div className="flex flex-col gap-2">
            <label className="text-gray-400 text-sm font-medium uppercase tracking-wider">
              Job Name
            </label>
            <input
              name="name"
              type="text"
              required
              placeholder="e.g. Johnson Kitchen Remodel"
              autoCapitalize="words"
              autoCorrect="on"
              className="bg-[#1A1A1A] border border-[#2a2a2a] text-white text-lg rounded-xl px-4 py-4 placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          {/* Job Type — multi-select */}
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
              placeholder="e.g. 123 Main St, Hillsboro, OR"
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
              placeholder="Any details, scope of work, client info..."
              className="bg-[#1A1A1A] border border-[#2a2a2a] text-white text-lg rounded-xl px-4 py-4 placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors resize-none"
            />
          </div>

          {/* Photo Upload */}
          <div className="flex flex-col gap-2">
            <label className="text-gray-400 text-sm font-medium uppercase tracking-wider">
              Photos
            </label>
            <label className="cursor-pointer bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 flex items-center justify-center gap-3 active:scale-95 transition-transform">
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
              <ul className="text-gray-500 text-sm pl-1">
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
            className="mt-2 bg-orange-500 text-white font-bold text-xl py-5 rounded-xl active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === "saving" ? "Saving..." : "Save Job"}
          </button>
        </form>
      </div>

      {/* ── Template picker sheet ── */}
      {templateSheetOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60"
            onClick={() => setTemplateSheetOpen(false)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
          >
            <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mt-3 mb-4" />
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest px-5 mb-3">
              Choose a Template
            </p>
            <div className="flex flex-col px-4 gap-2 overflow-y-auto max-h-[65vh] pb-2">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => pickTemplate(t)}
                  className="flex items-start gap-3 bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 text-left active:scale-95 transition-transform"
                >
                  <div className="w-9 h-9 rounded-lg bg-orange-500/15 flex items-center justify-center shrink-0 mt-0.5">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <line x1="9" y1="9" x2="15" y2="9"/>
                      <line x1="9" y1="13" x2="15" y2="13"/>
                      <line x1="9" y1="17" x2="12" y2="17"/>
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-base leading-tight">{t.name}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {t.job_types.map((jt) => (
                        <span key={jt} className="text-orange-400 text-xs bg-orange-500/10 px-2 py-0.5 rounded-full font-medium">
                          {TYPE_LABEL[jt] ?? jt}
                        </span>
                      ))}
                    </div>
                    <p className="text-gray-600 text-xs mt-1.5">
                      {t.materials.length} material{t.materials.length !== 1 ? "s" : ""} · {t.punch_list_items.length} punch list item{t.punch_list_items.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
