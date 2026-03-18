"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveJobQuote } from "@/app/actions/quotes";
import { Job, Material, LaborLog, QuoteAddon } from "@/types";
import { useJobCost } from "@/components/JobCostContext";
import { generateAndDownloadQuotePDF } from "@/lib/generateQuotePDF";

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
  const { quoteData, setQuoteData } = useJobCost();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [margin, setMargin] = useState(20);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [copied, setCopied] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [addons, setAddons] = useState<QuoteAddon[]>([]);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [laborLogs, setLaborLogs] = useState<LaborLog[]>([]);

  async function handleOpen() {
    setOpen(true);
    setSaved(false);
    setSaveError("");
    setLoading(true);

    // Pre-fill from existing quote if editing
    if (quoteData) {
      setMargin(quoteData.profitMarginPct);
      setAddons(quoteData.addons);
    } else {
      setMargin(20);
      setAddons([]);
    }

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
  const addonsTotal = addons.reduce((s, a) => s + a.amount, 0);
  const grandTotal = finalQuote + addonsTotal;

  const hasData = materialsTotal > 0 || laborTotal > 0;

  // ── Add-on helpers ────────────────────────────────────
  function addAddon() {
    setAddons([...addons, { name: "", description: "", amount: 0 }]);
    setSaved(false);
  }

  function removeAddon(i: number) {
    setAddons(addons.filter((_, idx) => idx !== i));
    setSaved(false);
  }

  function updateAddon(i: number, field: keyof QuoteAddon, value: string | number) {
    setAddons(addons.map((a, idx) => (idx === i ? { ...a, [field]: value } : a)));
    setSaved(false);
  }

  // ── Share text ────────────────────────────────────────
  function buildQuoteText() {
    const validAddons = addons.filter((a) => a.name.trim() && a.amount > 0);
    const lines = [
      "QUOTE",
      `Generated ${today()} · Sightline`,
      "",
      job.name,
      job.address ?? "",
      "",
      `Materials:       ${fmt(materialsTotal)}`,
      `Labor:           ${fmt(laborTotal)}`,
      `─────────────────────────`,
      `Subtotal:        ${fmt(subtotal)}`,
      `Profit (${margin}%):  ${fmt(profitAmount)}`,
      `─────────────────────────`,
      `Quote Total:     ${fmt(finalQuote)}`,
    ];
    if (validAddons.length > 0) {
      lines.push("", "ADD-ONS:");
      for (const a of validAddons) {
        lines.push(`  ${a.name}: ${fmt(a.amount)}`);
        if (a.description) lines.push(`    ${a.description}`);
      }
      lines.push(`─────────────────────────`);
      lines.push(`GRAND TOTAL:     ${fmt(grandTotal)}`);
    }
    return lines.join("\n");
  }

  async function handleCopy() {
    try {
      if (navigator.share) {
        await navigator.share({ title: `Quote — ${job.name}`, text: buildQuoteText() });
      } else {
        await navigator.clipboard.writeText(buildQuoteText());
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // dismissed
    }
  }

  async function handleDownloadPDF() {
    setPdfGenerating(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      // Fetch business profile + logo
      const { data: bp } = await supabase
        .from("business_profiles")
        .select("business_name,owner_name,license_number,address,phone,email,logo_path")
        .eq("user_id", user!.id)
        .maybeSingle();

      let logoUrl: string | null = null;
      if (bp?.logo_path) {
        const { data: signed } = await supabase.storage
          .from("business-logos")
          .createSignedUrl(bp.logo_path, 300);
        logoUrl = signed?.signedUrl ?? null;
      }

      // Fetch client if linked
      let client = null;
      if (job.client_id) {
        const { data: cl } = await supabase
          .from("clients")
          .select("name,company,address,phone,email")
          .eq("id", job.client_id)
          .maybeSingle();
        client = cl;
      }

      const validAddons = addons.filter((a) => a.name.trim() && a.amount > 0);
      const quoteNumber = `QUO-${job.id.slice(0, 8).toUpperCase()}`;

      const lineItems = materials
        .filter((m) => m.unit_cost !== null)
        .map((m) => ({
          description: m.name,
          qty: m.quantity_ordered,
          unit: m.unit || "ea",
          unitCost: Number(m.unit_cost),
          total: m.quantity_ordered * Number(m.unit_cost),
        }));

      const laborItems = laborLogs.map((l) => ({
        description: l.crew_name || "Labor",
        hours: Number(l.hours),
        rate: Number(l.rate),
        total: Number(l.hours) * Number(l.rate),
      }));

      await generateAndDownloadQuotePDF({
        contractorEmail: user?.email ?? "",
        jobName: job.name,
        jobAddress: job.address ?? "",
        jobTypes: job.types,
        date: today(),
        quoteNumber,
        materialsTotal,
        laborTotal,
        addons: validAddons.map((a) => ({ name: a.name, amount: Number(a.amount) })),
        profitMarginPct: margin,
        profitAmount,
        grandTotal,
        businessProfile: bp ?? null,
        logoUrl,
        client,
        lineItems,
        laborItems,
      });
    } finally {
      setPdfGenerating(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError("");
    const validAddons = addons.filter((a) => a.name.trim() && a.amount > 0);
    const result = await saveJobQuote({
      jobId: job.id,
      materialTotal: Math.round(materialsTotal),
      laborTotal: Math.round(laborTotal),
      profitMarginPct: margin,
      finalQuote: Math.round(finalQuote),
      addons: validAddons,
    });
    if (result?.error) {
      setSaveError(result.error);
    } else {
      setSaved(true);
      setAddons(validAddons);
      setQuoteData({
        materialBudget: Math.round(materialsTotal),
        laborBudget: Math.round(laborTotal),
        profitMarginPct: margin,
        finalQuote: Math.round(finalQuote),
        addons: validAddons,
      });
    }
    setSaving(false);
  }

  const isEditing = !!quoteData;
  const displayTotal = quoteData
    ? quoteData.finalQuote + quoteData.addons.reduce((s, a) => s + a.amount, 0)
    : 0;

  return (
    <>
      {/* Compact summary or Generate button */}
      {isEditing ? (
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">
                Quote
              </p>
              <p className="text-white font-black text-2xl">{fmt(displayTotal)}</p>
              {quoteData.addons.length > 0 && (
                <p className="text-gray-500 text-xs mt-0.5">
                  incl. {quoteData.addons.length} add-on
                  {quoteData.addons.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="text-orange-500 font-bold text-sm">
                {quoteData.profitMarginPct}% margin
              </span>
              <button
                onClick={handleOpen}
                className="text-white border border-[#2a2a2a] font-semibold text-sm px-4 py-2 rounded-xl active:scale-95 transition-transform min-h-[44px]"
              >
                Edit Quote
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={handleOpen}
          className="w-full bg-orange-500 text-white font-bold text-lg py-4 rounded-xl active:scale-95 transition-transform"
        >
          Generate Quote
        </button>
      )}

      {/* Full-screen overlay */}
      {open && (
        <div className="fixed inset-0 z-50 bg-[#0A0A0A] flex flex-col overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-6 pb-4 shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              <span className="text-white font-black text-xl tracking-tight">Sightline</span>
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
                    {isEditing ? "Edit Quote" : "Quote"} · {today()}
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
                    <span
                      className={`font-bold text-lg ${
                        materialsTotal > 0 ? "text-white" : "text-gray-600"
                      }`}
                    >
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
                    <span
                      className={`font-bold text-lg ${
                        laborTotal > 0 ? "text-white" : "text-gray-600"
                      }`}
                    >
                      {laborTotal > 0 ? fmt(laborTotal) : "—"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-[#2a2a2a]">
                    <p className="text-gray-400 font-semibold text-base">Subtotal</p>
                    <span className="text-gray-300 font-bold text-lg">{fmt(subtotal)}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <p className="text-gray-400 font-semibold text-base">
                      Profit{" "}
                      <span className="text-orange-500 font-bold">({margin}%)</span>
                    </p>
                    <span className="text-orange-500 font-bold text-lg">
                      +{fmt(profitAmount)}
                    </span>
                  </div>
                </div>

                {/* Add-ons in doc */}
                {addons.filter((a) => a.name && a.amount > 0).length > 0 && (
                  <div className="px-5 pb-4 flex flex-col gap-2 border-t border-[#2a2a2a] pt-4">
                    <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">
                      Add-Ons
                    </p>
                    {addons
                      .filter((a) => a.name && a.amount > 0)
                      .map((a, i) => (
                        <div key={i} className="flex justify-between items-start">
                          <div>
                            <p className="text-gray-300 text-sm font-semibold">{a.name}</p>
                            {a.description && (
                              <p className="text-gray-500 text-xs">{a.description}</p>
                            )}
                          </div>
                          <span className="text-white font-bold text-sm ml-4">
                            {fmt(a.amount)}
                          </span>
                        </div>
                      ))}
                  </div>
                )}

                {/* Total */}
                <div className="bg-[#1a1a1a] border-t border-[#242424] px-5 py-6 flex justify-between items-center">
                  <p className="text-white font-black text-xl uppercase tracking-wide">
                    Total
                  </p>
                  <p className="text-orange-500 font-black text-4xl leading-none">
                    {fmt(grandTotal)}
                  </p>
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

              {/* Add-ons section */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-gray-400 text-sm font-semibold uppercase tracking-wider">
                    Add-Ons
                  </p>
                  <button
                    onClick={addAddon}
                    className="text-orange-500 font-bold text-sm px-3 py-2 border border-orange-500/30 rounded-lg active:scale-95 transition-transform min-h-[44px]"
                  >
                    + Add Line Item
                  </button>
                </div>
                {addons.length === 0 && (
                  <p className="text-gray-600 text-sm">
                    No add-ons. Use these for upgrades or scope changes requested after the
                    original quote.
                  </p>
                )}
                {addons.map((a, i) => (
                  <div
                    key={i}
                    className="bg-[#141414] border border-[#242424] rounded-xl px-4 py-3 mb-3 flex flex-col gap-2"
                  >
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={a.name}
                        onChange={(e) => updateAddon(i, "name", e.target.value)}
                        placeholder="Name (e.g. Deck extension)"
                        className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] text-white text-sm px-3 py-2 rounded-lg min-h-[44px] placeholder-gray-600"
                      />
                      <button
                        onClick={() => removeAddon(i)}
                        className="text-gray-500 text-xl w-11 h-11 flex items-center justify-center active:scale-95"
                        aria-label="Remove add-on"
                      >
                        ×
                      </button>
                    </div>
                    <input
                      type="text"
                      value={a.description}
                      onChange={(e) => updateAddon(i, "description", e.target.value)}
                      placeholder="Description (optional)"
                      className="bg-[#1a1a1a] border border-[#2a2a2a] text-white text-sm px-3 py-2 rounded-lg min-h-[44px] placeholder-gray-600"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-sm font-semibold">$</span>
                      <input
                        type="number"
                        value={a.amount || ""}
                        onChange={(e) => updateAddon(i, "amount", Number(e.target.value))}
                        placeholder="Amount"
                        min="0"
                        className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] text-white text-sm px-3 py-2 rounded-lg min-h-[44px] placeholder-gray-600"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div className="mt-6 flex flex-col gap-3">
                <div className="flex gap-3">
                  <button
                    onClick={handleCopy}
                    className="flex-1 flex items-center justify-center gap-2 bg-[#1A1A1A] border border-[#2a2a2a] text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform"
                  >
                    {copied ? (
                      <span className="text-green-400">✓ Copied</span>
                    ) : (
                      <><span>📤</span> Share</>
                    )}
                  </button>
                  <button
                    onClick={handleDownloadPDF}
                    disabled={pdfGenerating}
                    className="flex-1 flex items-center justify-center gap-2 bg-[#1A1A1A] border border-[#2a2a2a] text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
                  >
                    {pdfGenerating ? (
                      <span className="text-gray-400">Building...</span>
                    ) : (
                      <><span>📄</span> Download PDF</>
                    )}
                  </button>
                </div>

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
                    {saving ? "Saving..." : isEditing ? "Update Quote" : "Save Quote to Job"}
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
