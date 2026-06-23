"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createJob } from "@/app/actions/jobs";
import { applyTemplateToJob } from "@/app/actions/templates";
import { getCustomJobTypes, saveCustomJobType } from "@/app/actions/custom-job-types";
import { createClientRecord } from "@/app/actions/clients";
import ClientNameAutocomplete from "@/components/ClientNameAutocomplete";
import AddressAutocomplete from "@/components/AddressAutocomplete";

const BUILT_IN_TYPES = [
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
  { value: "fencing", label: "Fencing" },
];

const TYPE_LABEL: Record<string, string> = Object.fromEntries(BUILT_IN_TYPES.map((t) => [t.value, t.label]));

interface Template {
  id: string;
  name: string;
  job_types: string[];
  materials: { name: string; unit: string }[];
  punch_list_items: string[];
}

export default function NewJobForm({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [photoNames, setPhotoNames] = useState<string[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateSheetOpen, setTemplateSheetOpen] = useState(false);
  const [showOptional, setShowOptional] = useState(false);

  // Custom job types
  const [customTypes, setCustomTypes] = useState<{ value: string; label: string }[]>([]);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customInput, setCustomInput] = useState("");

  useEffect(() => {
    getCustomJobTypes().then(setCustomTypes);
  }, []);

  const allTypes = [...BUILT_IN_TYPES, ...customTypes];

  async function confirmCustomType() {
    const label = customInput.trim();
    if (!label) return;
    const lower = label.toLowerCase();
    if (!allTypes.some((t) => t.value.toLowerCase() === lower)) {
      setCustomTypes((prev) => [...prev, { value: label, label }]);
    }
    if (!selectedTypes.includes(label)) {
      setSelectedTypes((prev) => [...prev, label]);
    }
    await saveCustomJobType(label);
    setCustomInput("");
    setShowCustomInput(false);
  }

  function toggleType(value: string) {
    setSelectedTypes((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
    );
  }

  function pickTemplate(t: Template) {
    setSelectedTemplate(t);
    setSelectedTypes(t.job_types);
    setTemplateSheetOpen(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!clientName.trim()) {
      setErrorMsg("Client name is required.");
      setStatus("error");
      return;
    }
    setStatus("saving");
    setErrorMsg("");

    const formData = new FormData(e.currentTarget);
    formData.delete("types");
    selectedTypes.forEach((t) => formData.append("types", t));

    // Resolve the client: use the selected one, or create a new client from the typed name.
    let resolvedClientId = clientId;
    if (!resolvedClientId && clientName.trim()) {
      const res = await createClientRecord({ name: clientName.trim() });
      if (res.error || !res.client) {
        setErrorMsg(res.error ?? "Could not save the client. Try again.");
        setStatus("error");
        return;
      }
      resolvedClientId = res.client.id;
    }
    if (resolvedClientId) formData.set("client_id", resolvedClientId);

    const result = await createJob(formData);

    if (result.error || !result.jobId) {
      setErrorMsg(result.error ?? "Could not create the job. Try again.");
      setStatus("error");
      return;
    }

    if (selectedTemplate) {
      await applyTemplateToJob(result.jobId, selectedTemplate.id);
    }

    // Always go straight to the job detail page — never the jobs list.
    router.push(`/jobs/${result.jobId}`);
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setPhotoNames(files.map((f) => f.name));
  }

  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-6">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <h1 className="text-2xl font-bold text-white mb-5">New Job</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* 1 — Job Name (prominent) */}
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
              autoFocus
              className="w-full bg-[#1A1A1A] border border-[#2a2a2a] text-white text-xl font-semibold rounded-xl px-4 py-5 placeholder:text-gray-600 placeholder:font-normal focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          {/* 2 — Client Name (required, autocomplete) */}
          <ClientNameAutocomplete
            onChange={(id, name) => {
              setClientId(id);
              setClientName(name);
            }}
          />

          {/* 3 — Job Address (required, prominent) */}
          <AddressAutocomplete />

          {/* Optional section — collapsed by default */}
          <button
            type="button"
            onClick={() => setShowOptional((v) => !v)}
            className="flex items-center gap-2 text-gray-400 text-sm font-semibold active:text-gray-200 transition-colors self-start min-h-[44px]"
          >
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={`transition-transform duration-200 ${showOptional ? "rotate-90" : ""}`}
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
            Optional — job type, dates, lockbox, notes, photos
          </button>

          {showOptional && (
            <div className="flex flex-col gap-5 border-l-2 border-[#2a2a2a] pl-4">
              {/* Template picker */}
              {templates.length > 0 && (
                selectedTemplate ? (
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
                      onClick={() => setSelectedTemplate(null)}
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
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <line x1="9" y1="9" x2="15" y2="9" />
                          <line x1="9" y1="13" x2="15" y2="13" />
                          <line x1="9" y1="17" x2="12" y2="17" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <p className="text-white font-semibold text-sm">Start from a template</p>
                        <p className="text-gray-500 text-xs">{templates.length} template{templates.length !== 1 ? "s" : ""} available</p>
                      </div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                )
              )}

              {/* Job Type — multi-select */}
              <div className="flex flex-col gap-3">
                <label className="text-gray-400 text-sm font-medium uppercase tracking-wider">
                  Job Type <span className="text-gray-500 normal-case">(select all that apply)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {allTypes.map(({ value, label }) => {
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
                  {!showCustomInput && (
                    <button
                      type="button"
                      onClick={() => setShowCustomInput(true)}
                      className="flex items-center gap-3 px-4 py-4 rounded-xl border border-dashed border-[#2a2a2a] bg-[#1A1A1A] text-gray-500 text-left transition-colors active:scale-95"
                    >
                      <span className="w-5 h-5 shrink-0 rounded border-2 border-gray-600 flex items-center justify-center text-gray-600 text-lg leading-none">+</span>
                      <span className="text-base">Custom…</span>
                    </button>
                  )}
                </div>
                {showCustomInput && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      autoFocus
                      placeholder="e.g. Masonry, Demolition…"
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmCustomType(); } }}
                      autoCapitalize="words"
                      className="flex-1 bg-[#1A1A1A] border border-orange-500 text-white rounded-xl px-4 py-4 text-base focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={confirmCustomType}
                      className="bg-orange-500 text-white font-bold px-5 py-4 rounded-xl active:scale-95 transition-transform"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowCustomInput(false); setCustomInput(""); }}
                      className="bg-[#242424] text-gray-400 font-bold px-4 py-4 rounded-xl active:scale-95 transition-transform"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* Estimated completion date */}
              <div className="flex flex-col gap-2">
                <label className="text-gray-400 text-sm font-medium uppercase tracking-wider">
                  Estimated Completion <span className="text-gray-600 normal-case font-normal">(optional)</span>
                </label>
                <input
                  name="estimated_completion_date"
                  type="date"
                  className="bg-[#1A1A1A] border border-[#2a2a2a] text-white text-lg rounded-xl px-4 py-4 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              {/* Lockbox code */}
              <div className="flex flex-col gap-2">
                <label className="text-gray-400 text-sm font-medium uppercase tracking-wider">
                  Lockbox Code <span className="text-gray-600 normal-case font-normal">(optional)</span>
                </label>
                <input
                  name="lockbox_code"
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g. 1234"
                  className="bg-[#1A1A1A] border border-[#2a2a2a] text-white text-lg rounded-xl px-4 py-4 placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-2">
                <label className="text-gray-400 text-sm font-medium uppercase tracking-wider">
                  Notes <span className="text-gray-600 normal-case font-normal">(optional)</span>
                </label>
                <textarea
                  name="notes"
                  rows={3}
                  placeholder="Scope of work, access instructions, crew notes..."
                  className="bg-[#1A1A1A] border border-[#2a2a2a] text-white text-lg rounded-xl px-4 py-4 placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors resize-none"
                />
              </div>

              {/* Before photos */}
              <div className="flex flex-col gap-2">
                <label className="text-gray-400 text-sm font-medium uppercase tracking-wider">
                  Before Photos <span className="text-gray-600 normal-case font-normal">(optional)</span>
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
            </div>
          )}

          {/* Error */}
          {status === "error" && (
            <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-xl px-4 py-3">
              {errorMsg}
            </p>
          )}

          {/* Submit — large, orange, visible without scrolling */}
          <button
            type="submit"
            disabled={status === "saving"}
            className="bg-orange-500 text-white font-bold text-xl py-5 rounded-xl active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === "saving" ? "Creating job…" : "Create Job"}
          </button>
        </form>
      </div>

      {/* Template picker sheet */}
      {templateSheetOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setTemplateSheetOpen(false)} />
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
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <line x1="9" y1="9" x2="15" y2="9" />
                      <line x1="9" y1="13" x2="15" y2="13" />
                      <line x1="9" y1="17" x2="12" y2="17" />
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
