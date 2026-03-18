"use client";

import { useState } from "react";
import { saveJobAsTemplate } from "@/app/actions/templates";

export default function SaveAsTemplateButton({
  jobId,
  defaultName,
}: {
  jobId: string;
  defaultName: string;
}) {
  const [open, setOpen]       = useState(false);
  const [name, setName]       = useState(defaultName);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState("");

  async function handleSave() {
    if (!name.trim()) { setError("Template name is required."); return; }
    setSaving(true);
    setError("");
    const result = await saveJobAsTemplate(jobId, name.trim());
    setSaving(false);
    if (result.error) { setError(result.error); return; }
    setSaved(true);
    setTimeout(() => { setOpen(false); setSaved(false); }, 1500);
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setName(defaultName); setSaved(false); setError(""); }}
        className="flex items-center gap-2 text-gray-400 border border-[#2a2a2a] text-sm font-semibold px-4 py-3 rounded-xl active:scale-95 transition-transform min-h-[44px]"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg>
        Save as Template
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60"
            onClick={() => !saving && setOpen(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl px-5 pt-5 pb-safe"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}>
            <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mb-5" />

            <h2 className="text-white font-bold text-xl mb-1">Save as Template</h2>
            <p className="text-gray-500 text-sm mb-5">
              Saves this job's materials and punch list as a reusable template.
            </p>

            <label className="text-gray-400 text-xs font-bold uppercase tracking-wider block mb-2">
              Template Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Template name"
              className="w-full bg-[#1A1A1A] border border-[#2a2a2a] text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500 transition-colors mb-4"
              autoFocus
            />

            {error && (
              <p className="text-red-400 text-sm mb-3">{error}</p>
            )}

            {saved ? (
              <div className="flex items-center justify-center gap-2 w-full bg-green-600 text-white font-bold text-base py-4 rounded-xl">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                Template Saved
              </div>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Template"}
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}
