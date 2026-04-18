"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { JobTemplate, TemplateMaterial, createTemplate, updateTemplate } from "@/app/actions/templates";
import { X, Plus } from "lucide-react";

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
];

const UNITS = ["ea", "sq ft", "ln ft", "bag", "sheet", "gal", "roll", "tube", "box", "lb", "hr", "day"];

const CATEGORIES = ["materials", "labor", "equipment", "subcontractor", "permits", "other"];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">{children}</p>
  );
}

export default function TemplateForm({ template }: { template?: JobTemplate }) {
  const router = useRouter();
  const isEdit = !!template;

  const [name, setName]               = useState(template?.name ?? "");
  const [jobTypes, setJobTypes]       = useState<string[]>(template?.job_types ?? []);
  const [materials, setMaterials]     = useState<TemplateMaterial[]>(
    template?.materials ?? [{ name: "", unit: "ea", category: "materials" }]
  );
  const [laborCats, setLaborCats]     = useState<string[]>(template?.labor_categories ?? [""]);
  const [punchItems, setPunchItems]   = useState<string[]>(template?.punch_list_items ?? [""]);
  const [notes, setNotes]             = useState(template?.notes ?? "");
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");

  function toggleType(v: string) {
    setJobTypes((prev) => prev.includes(v) ? prev.filter((t) => t !== v) : [...prev, v]);
  }

  // ── Materials ──
  function addMaterial() {
    setMaterials((prev) => [...prev, { name: "", unit: "ea", category: "materials" }]);
  }
  function updateMaterial(i: number, field: keyof TemplateMaterial, value: string) {
    setMaterials((prev) => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m));
  }
  function removeMaterial(i: number) {
    setMaterials((prev) => prev.filter((_, idx) => idx !== i));
  }

  // ── Labor categories ──
  function addLabor() { setLaborCats((prev) => [...prev, ""]); }
  function updateLabor(i: number, v: string) {
    setLaborCats((prev) => prev.map((lc, idx) => idx === i ? v : lc));
  }
  function removeLabor(i: number) {
    setLaborCats((prev) => prev.filter((_, idx) => idx !== i));
  }

  // ── Punch list ──
  function addPunch() { setPunchItems((prev) => [...prev, ""]); }
  function updatePunch(i: number, v: string) {
    setPunchItems((prev) => prev.map((p, idx) => idx === i ? v : p));
  }
  function removePunch(i: number) {
    setPunchItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    setSaving(true);
    setError("");

    const payload = {
      name: name.trim(),
      job_types: jobTypes,
      materials: materials.filter((m) => m.name.trim()),
      labor_categories: laborCats.filter((lc) => lc.trim()),
      punch_list_items: punchItems.filter((p) => p.trim()),
      notes: notes.trim() || null,
    };

    const result = isEdit
      ? await updateTemplate(template!.id, payload)
      : await createTemplate(payload);

    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    router.push("/templates");
  }

  const inputCls = "w-full bg-[#242424] border border-[#2a2a2a] text-white rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-500 transition-colors placeholder:text-gray-600";

  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-8 pb-32">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => router.back()}
            className="text-gray-400 text-2xl leading-none active:scale-95 transition-transform min-w-[48px] min-h-[48px] flex items-center justify-center"
          >
            ←
          </button>
          <h1 className="text-3xl font-bold text-white">
            {isEdit ? "Edit Template" : "New Template"}
          </h1>
        </div>

        <div className="flex flex-col gap-6">
          {/* Template Name */}
          <div>
            <SectionLabel>Template Name</SectionLabel>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bathroom Remodel"
              autoCapitalize="words"
              autoCorrect="on"
              className={inputCls}
            />
          </div>

          {/* Job Types */}
          <div>
            <SectionLabel>Job Types</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {JOB_TYPES.map(({ value, label }) => {
                const active = jobTypes.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleType(value)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors active:scale-95 text-sm font-semibold ${
                      active
                        ? "bg-orange-500 text-white border-orange-500"
                        : "bg-[#1A1A1A] text-gray-300 border-[#2a2a2a]"
                    }`}
                  >
                    <span className={`w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center ${active ? "bg-white border-white" : "border-gray-500"}`}>
                      {active && (
                        <svg className="w-2.5 h-2.5 text-orange-500" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      )}
                    </span>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Materials */}
          <div>
            <SectionLabel>Default Materials</SectionLabel>
            <p className="text-gray-600 text-xs mb-3">Name and unit only — quantities and costs are entered per job.</p>
            <div className="flex flex-col gap-2">
              {materials.map((m, i) => (
                <div key={i} className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={m.name}
                      onChange={(e) => updateMaterial(i, "name", e.target.value)}
                      placeholder="Material name"
                      className="flex-1 bg-[#242424] border border-[#2a2a2a] text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 min-h-[44px] placeholder:text-gray-600"
                    />
                    <button
                      type="button"
                      onClick={() => removeMaterial(i)}
                      className="text-gray-600 w-10 h-10 flex items-center justify-center active:text-red-400 shrink-0"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={m.unit}
                      onChange={(e) => updateMaterial(i, "unit", e.target.value)}
                      className="flex-1 bg-[#242424] border border-[#2a2a2a] text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none min-h-[44px]"
                    >
                      {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <select
                      value={m.category}
                      onChange={(e) => updateMaterial(i, "category", e.target.value)}
                      className="flex-1 bg-[#242424] border border-[#2a2a2a] text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none min-h-[44px] capitalize"
                    >
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addMaterial}
                className="flex items-center justify-center gap-2 border border-dashed border-[#2a2a2a] text-gray-500 text-sm py-3 rounded-xl active:opacity-70 min-h-[48px]"
              >
                <Plus size={15} />
                Add Material
              </button>
            </div>
          </div>

          {/* Labor Categories */}
          <div>
            <SectionLabel>Labor Categories</SectionLabel>
            <p className="text-gray-600 text-xs mb-3">Labels for the types of work on this job (e.g. "Demo", "Install", "Cleanup").</p>
            <div className="flex flex-col gap-2">
              {laborCats.map((lc, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={lc}
                    onChange={(e) => updateLabor(i, e.target.value)}
                    placeholder="e.g. Framing, Demo, Paint"
                    className="flex-1 bg-[#242424] border border-[#2a2a2a] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 min-h-[48px] placeholder:text-gray-600"
                  />
                  <button
                    type="button"
                    onClick={() => removeLabor(i)}
                    className="text-gray-600 w-10 h-10 flex items-center justify-center active:text-red-400 shrink-0"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addLabor}
                className="flex items-center justify-center gap-2 border border-dashed border-[#2a2a2a] text-gray-500 text-sm py-3 rounded-xl active:opacity-70 min-h-[48px]"
              >
                <Plus size={15} />
                Add Labor Category
              </button>
            </div>
          </div>

          {/* Punch List */}
          <div>
            <SectionLabel>Default Punch List</SectionLabel>
            <div className="flex flex-col gap-2">
              {punchItems.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded border border-[#3a3a3a] shrink-0" />
                  <input
                    value={p}
                    onChange={(e) => updatePunch(i, e.target.value)}
                    placeholder="Checklist item"
                    className="flex-1 bg-[#242424] border border-[#2a2a2a] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 min-h-[48px] placeholder:text-gray-600"
                  />
                  <button
                    type="button"
                    onClick={() => removePunch(i)}
                    className="text-gray-600 w-10 h-10 flex items-center justify-center active:text-red-400 shrink-0"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addPunch}
                className="flex items-center justify-center gap-2 border border-dashed border-[#2a2a2a] text-gray-500 text-sm py-3 rounded-xl active:opacity-70 min-h-[48px]"
              >
                <Plus size={15} />
                Add Punch List Item
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <SectionLabel>Notes (optional)</SectionLabel>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about when to use this template…"
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-xl px-4 py-3">{error}</p>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-orange-500 text-white font-bold text-xl py-5 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
          >
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Save Template"}
          </button>
        </div>
      </div>
    </div>
  );
}
