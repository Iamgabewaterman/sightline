"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveJobQuote } from "@/app/actions/quotes";
import { Job, Material, LaborLog } from "@/types";

function fmt(n: number) {
  return "$" + Math.round(n).toLocaleString();
}

function today() {
  return new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

interface Props {
  job: Job;
}

export default function GenerateQuote({ job }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [margin, setMargin] = useState(20);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [copied, setCopied] = useState(false);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [laborLogs, setLaborLogs] = useState<LaborLog[]>([]);

  async function handleOpen() {
    setOpen(true);
    setSaved(false);
    setSaveError("");
    setLoading(true);

    const supabase = createClient();
    const [{ data: mats }, { data: labor }] = await Promise.all([
      supabase
        .from("materials")
        .select("*")
        .eq("job_id", job.id)
        .returns<Material[]>(),
      supabase
        .from("labor_logs")
        .select("*")
        .eq("job_id", job.id)
        .returns<LaborLog[]>(),
    ]);

    setMaterials(mats ?? []);
    setLaborLogs(labor ?? []);
    setLoading(false);
  }

  // ── Calculations ──────────────────────────────────────
  const materialsWithCost = materials.filter((m) => m.unit_cost !== null);
  const materialsTotal = materialsWithCost.reduce(
    (sum, m) => sum + m.quantity_ordered * Number(m.unit_cost),
    0
  );

  const laborTotal = laborLogs.reduce(
    (sum, l) => sum + Number(l.hours) * Number(l.rate),
    0
  );

  const subtotal = materialsTotal + laborTotal;
  const profitAmount = subtotal * (margin / 100);
  const finalQuote = subtotal + profitAmount;

  const hasData = materialsTotal > 0 || laborTotal > 0;

  // ── Copy / Share ──────────────────────────────────────
  function buildQuoteText() {
    const lines = [
      "QUOTE",
      `Generated ${today()} · Sightline`,
      "",
      job.name,
      job.address,
      "",
      `Materials:    ${fmt(materialsTotal)}`,
      `Labor:        ${fmt(laborTotal)}`,
      `─────────────────────`,
      `Subtotal:     ${fmt(subtotal)}`,
      `Profit (${margin}%): ${fmt(profitAmount)}`,
      `─────────────────────`,
      `TOTAL:        ${fmt(finalQuote)}`,
    ];
    return lines.join("\n");
  }

  async function handleCopy() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Quote — ${job.name}`,
          text: buildQuoteText(),
        });
      } else {
        await navigator.clipboard.writeText(buildQuoteText());
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // user dismissed share sheet — no-op
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError("");
    const result = await saveJobQuote({
      jobId: job.id,
      materialTotal: Math.round(materialsTotal),
      laborTotal: Math.round(laborTotal),
      profitMarginPct: margin,
      finalQuote: Math.round(finalQuote),
    });
    if (result?.error) {
      setSaveError(result.error);
    } else {
      setSaved(true);
    }
    setSaving(false);
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={handleOpen}
        className="w-full bg-orange-500 text-white font-bold text-lg py-4 rounded-xl active:scale-95 transition-transform"
      >
        Generate Quote
      </button>

      {/* Full-screen overlay */}
      {open && (
        <div className="fixed inset-0 z-50 bg-[#0A0A0A] flex flex-col overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-6 pb-4 shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              <span className="text-white font-black text-xl tracking-tight">
                Sightline
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 text-3xl leading-none w-11 h-11 flex items-center justify-center active:scale-95 transition-transform"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-500 animate-pulse">Loading job data...</p>
            </div>
          ) : (
            <div className="flex-1 px-5 pb-6">
              {/* Quote document */}
              <div className="bg-[#141414] border border-[#242424] rounded-2xl overflow-hidden">
                {/* Doc header */}
                <div className="px-5 py-5 border-b border-[#242424]">
                  <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-3">
                    Quote · {today()}
                  </p>
                  <h2 className="text-white font-black text-2xl leading-tight mb-1">
                    {job.name}
                  </h2>
                  <p className="text-gray-400 text-sm">{job.address}</p>
                </div>

                {/* Line items */}
                <div className="px-5 py-5 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-gray-300 font-semibold text-base">Materials</p>
                      {materialsWithCost.length > 0 && (
                        <p className="text-gray-500 text-xs mt-0.5">
                          {materialsWithCost.length} item
                          {materialsWithCost.length !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                    <span className={`font-bold text-lg ${materialsTotal > 0 ? "text-white" : "text-gray-600"}`}>
                      {materialsTotal > 0 ? fmt(materialsTotal) : "—"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-gray-300 font-semibold text-base">Labor</p>
                      {laborLogs.length > 0 && (
                        <p className="text-gray-500 text-xs mt-0.5">
                          {laborLogs.length} entr
                          {laborLogs.length !== 1 ? "ies" : "y"}
                        </p>
                      )}
                    </div>
                    <span className={`font-bold text-lg ${laborTotal > 0 ? "text-white" : "text-gray-600"}`}>
                      {laborTotal > 0 ? fmt(laborTotal) : "—"}
                    </span>
                  </div>

                  {/* Subtotal */}
                  <div className="flex justify-between items-center pt-3 border-t border-[#2a2a2a]">
                    <p className="text-gray-400 font-semibold text-base">Subtotal</p>
                    <span className="text-gray-300 font-bold text-lg">{fmt(subtotal)}</span>
                  </div>

                  {/* Profit */}
                  <div className="flex justify-between items-center">
                    <p className="text-gray-400 font-semibold text-base">
                      Profit <span className="text-orange-500 font-bold">({margin}%)</span>
                    </p>
                    <span className="text-orange-500 font-bold text-lg">+{fmt(profitAmount)}</span>
                  </div>
                </div>

                {/* Total */}
                <div className="bg-[#1a1a1a] border-t border-[#242424] px-5 py-6 flex justify-between items-center">
                  <p className="text-white font-black text-xl uppercase tracking-wide">Total</p>
                  <p className="text-orange-500 font-black text-4xl leading-none">{fmt(finalQuote)}</p>
                </div>
              </div>

              {/* No data warning */}
              {!hasData && (
                <div className="mt-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3">
                  <p className="text-gray-500 text-sm text-center">
                    Add materials with unit costs and labor entries to populate this quote.
                  </p>
                </div>
              )}

              {/* Margin slider */}
              <div className="mt-6">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-gray-400 text-sm font-semibold uppercase tracking-wider">
                    Profit Margin
                  </p>
                  <span className="text-orange-500 font-black text-xl">{margin}%</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={50}
                  step={1}
                  value={margin}
                  onChange={(e) => {
                    setMargin(Number(e.target.value));
                    setSaved(false);
                  }}
                  className="range-slider w-full"
                />
                <div className="flex justify-between text-gray-600 text-xs mt-1">
                  <span>5%</span>
                  <span>50%</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-6 flex flex-col gap-3">
                <button
                  onClick={handleCopy}
                  className="w-full flex items-center justify-center gap-2 bg-[#1A1A1A] border border-[#2a2a2a] text-white font-bold text-lg py-4 rounded-xl active:scale-95 transition-transform"
                >
                  {copied ? (
                    <>
                      <span className="text-green-400">✓</span>
                      <span className="text-green-400">Copied to clipboard</span>
                    </>
                  ) : (
                    <>
                      <span>📤</span>
                      Share / Copy Quote
                    </>
                  )}
                </button>

                {saved ? (
                  <div className="w-full flex items-center justify-center gap-2 bg-green-900/30 border border-green-800 text-green-400 font-bold text-lg py-4 rounded-xl">
                    <span>✓</span> Quote Saved
                  </div>
                ) : (
                  <button
                    onClick={handleSave}
                    disabled={saving || !hasData}
                    className="w-full bg-orange-500 text-white font-bold text-lg py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Quote to Job"}
                  </button>
                )}

                {saveError && (
                  <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-xl px-4 py-3">
                    {saveError}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
