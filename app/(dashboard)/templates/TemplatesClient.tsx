"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { JobTemplate, deleteTemplate } from "@/app/actions/templates";
import Link from "next/link";

const TYPE_LABEL: Record<string, string> = {
  drywall: "Drywall", framing: "Framing", plumbing: "Plumbing",
  paint: "Paint", trim: "Trim", roofing: "Roofing", tile: "Tile",
  flooring: "Flooring", electrical: "Electrical", hvac: "HVAC",
  concrete: "Concrete", landscaping: "Landscaping", decks_patios: "Decks & Patios", fencing: "Fencing",
};

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-block bg-orange-500/15 text-orange-400 text-xs font-semibold px-2 py-0.5 rounded-full">
      {TYPE_LABEL[type] ?? type}
    </span>
  );
}

function TemplateCard({
  template,
  onDelete,
}: {
  template: JobTemplate;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirming) { setConfirming(true); return; }
    setDeleting(true);
    await deleteTemplate(template.id);
    onDelete(template.id);
  }

  return (
    <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full text-left px-5 py-4 flex items-start justify-between gap-3 active:opacity-80"
      >
        <div className="min-w-0">
          <p className="text-white font-semibold text-base leading-tight mb-2">{template.name}</p>
          <div className="flex flex-wrap gap-1.5">
            {template.job_types.map((t) => <TypeBadge key={t} type={t} />)}
          </div>
          <p className="text-gray-600 text-xs mt-2">
            {template.materials.length} material{template.materials.length !== 1 ? "s" : ""} ·{" "}
            {template.punch_list_items.length} punch list item{template.punch_list_items.length !== 1 ? "s" : ""}
          </p>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 mt-1 transition-transform ${expanded ? "rotate-90" : ""}`}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>

      {/* Expanded preview */}
      {expanded && (
        <div className="border-t border-[#2a2a2a] px-5 py-4 flex flex-col gap-4">
          {template.materials.length > 0 && (
            <div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Materials</p>
              <div className="flex flex-col gap-1">
                {template.materials.map((m, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-gray-300 text-sm">{m.name}</span>
                    <span className="text-gray-600 text-xs">{m.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {template.labor_categories.length > 0 && (
            <div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Labor Categories</p>
              <div className="flex flex-wrap gap-1.5">
                {template.labor_categories.map((lc, i) => (
                  <span key={i} className="bg-[#242424] text-gray-300 text-xs px-2.5 py-1 rounded-full">{lc}</span>
                ))}
              </div>
            </div>
          )}

          {template.punch_list_items.length > 0 && (
            <div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Punch List</p>
              <div className="flex flex-col gap-1">
                {template.punch_list_items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded border border-[#3a3a3a] shrink-0" />
                    <span className="text-gray-300 text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {template.notes && (
            <div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Notes</p>
              <p className="text-gray-400 text-sm">{template.notes}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Link
              href={`/templates/${template.id}/edit`}
              className="flex-1 text-center bg-[#242424] border border-[#2a2a2a] text-white font-semibold text-sm py-3 rounded-xl active:scale-95 transition-transform"
            >
              Edit
            </Link>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className={`flex-1 text-sm font-semibold py-3 rounded-xl active:scale-95 transition-transform border ${
                confirming
                  ? "bg-red-600 border-red-600 text-white"
                  : "bg-[#242424] border-[#2a2a2a] text-red-400"
              } disabled:opacity-50`}
            >
              {deleting ? "Deleting…" : confirming ? "Confirm Delete" : "Delete"}
            </button>
          </div>
          {confirming && !deleting && (
            <button
              onClick={() => setConfirming(false)}
              className="text-gray-500 text-xs text-center active:opacity-70"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function TemplatesClient({ initialTemplates }: { initialTemplates: JobTemplate[] }) {
  const [templates, setTemplates] = useState(initialTemplates);
  const router = useRouter();

  function handleDelete(id: string) {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-8 pb-32">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => router.back()}
            className="text-gray-400 text-2xl leading-none active:scale-95 transition-transform min-w-[48px] min-h-[48px] flex items-center justify-center"
          >
            ←
          </button>
          <h1 className="text-3xl font-bold text-white">Templates</h1>
        </div>

        <Link
          href="/templates/new"
          className="flex items-center justify-center gap-2 w-full bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform mb-6"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Create from Scratch
        </Link>

        {templates.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-600 text-base">No templates yet.</p>
            <p className="text-gray-700 text-sm mt-1">Create one above or save a completed job as a template.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {templates.map((t) => (
              <TemplateCard key={t.id} template={t} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
