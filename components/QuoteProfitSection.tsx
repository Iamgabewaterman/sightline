"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveJobQuote, saveLineItem, sendForSignature } from "@/app/actions/quotes";
import { fetchHistoricalCostRange } from "@/app/actions/insights";
import { Job, Material, LaborLog, QuoteAddon, SavedLineItem } from "@/types";
import { HistoricalCostRange } from "@/lib/insights";
import { useJobCost } from "@/components/JobCostContext";
import { generateAndDownloadQuotePDF } from "@/lib/generateQuotePDF";
import { useRole } from "@/hooks/useRole";
import ChangeOrdersSection from "./ChangeOrdersSection";

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

export default function QuoteProfitSection({
  job,
  estimateId: initialEstimateId,
  quoteStatus: initialQuoteStatus,
  signedAt: initialSignedAt,
  signedByName: initialSignedByName,
}: {
  job: Job;
  estimateId: string | null;
  quoteStatus: string;
  signedAt: string | null;
  signedByName: string | null;
}) {
  const { role, can_see_financials } = useRole();
  const { actualMaterialCost, actualLaborCost, actualSubCost, quoteData, setQuoteData, changeOrders } = useJobCost();

  // Field members without financial permission see nothing here
  if (role === "field_member" && !can_see_financials) return null;

  // Local signature state (updates after send/duplicate)
  const [localEstimateId, setLocalEstimateId] = useState<string | null>(initialEstimateId);
  const [localQuoteStatus, setLocalQuoteStatus] = useState(initialQuoteStatus);
  const [localSignedAt, setLocalSignedAt] = useState<string | null>(initialSignedAt);
  const [localSignedByName, setLocalSignedByName] = useState<string | null>(initialSignedByName);

  const isSigned = localQuoteStatus === "accepted";

  // Send for signature state
  const [sigSheetOpen, setSigSheetOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sigUrl, setSigUrl] = useState<string | null>(null);
  const [copied, setCopiedSig] = useState(false);
  const [sigError, setSigError] = useState("");
  const [duplicating, setDuplicating] = useState(false);

  async function handleSendForSignature() {
    if (!localEstimateId) return;
    setSending(true);
    setSigError("");
    const result = await sendForSignature(localEstimateId);
    setSending(false);
    if (result.error) { setSigError(result.error); return; }
    setSigUrl(result.url ?? null);
    setLocalQuoteStatus("sent");
    setSigSheetOpen(true);
  }

  async function handleCopySigUrl() {
    if (!sigUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: `Quote — ${job.name}`, url: sigUrl });
      } else {
        await navigator.clipboard.writeText(sigUrl);
        setCopiedSig(true);
        setTimeout(() => setCopiedSig(false), 2500);
      }
    } catch { /* dismissed */ }
  }

  async function handleDuplicate() {
    if (!quoteData) return;
    setDuplicating(true);
    const result = await saveJobQuote({
      jobId: job.id,
      materialTotal: quoteData.materialBudget,
      laborTotal: quoteData.laborBudget,
      profitMarginPct: quoteData.profitMarginPct,
      finalQuote: quoteData.finalQuote,
      addons: quoteData.addons,
    });
    if (result.estimateId) {
      setLocalEstimateId(result.estimateId);
      setLocalQuoteStatus("draft");
      setLocalSignedAt(null);
      setLocalSignedByName(null);
    }
    setDuplicating(false);
  }

  // Overlay
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [margin, setMargin] = useState(20);
  const [addons, setAddons] = useState<QuoteAddon[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [copiedShare, setCopiedShare] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);

  // Fetched data
  const [materials, setMaterials] = useState<Material[]>([]);
  const [laborLogs, setLaborLogs] = useState<LaborLog[]>([]);
  const [savedItems, setSavedItems] = useState<SavedLineItem[]>([]);
  const [subTotal, setSubTotal] = useState(0);

  // Per-row "saved" tracking
  const [savingItemIdx, setSavingItemIdx] = useState<number | null>(null);
  const [savedIdxSet, setSavedIdxSet] = useState<Set<number>>(new Set());

  // Historical cost range banner
  const [historicalRange, setHistoricalRange] = useState<HistoricalCostRange | null>(null);

  async function handleOpen() {
    setOpen(true);
    setSaved(false);
    setSaveError("");
    setSavedIdxSet(new Set());
    setLoading(true);

    if (quoteData) {
      setMargin(quoteData.profitMarginPct);
      setAddons(quoteData.addons.map((a) => ({ name: a.name, amount: a.amount })));
    } else {
      setMargin(20);
      setAddons([]);
    }

    const supabase = createClient();
    const [{ data: mats }, { data: labor }, { data: saved }, { data: subs }, range] = await Promise.all([
      supabase.from("materials").select("*").eq("job_id", job.id).returns<Material[]>(),
      supabase.from("labor_logs").select("*").eq("job_id", job.id).returns<LaborLog[]>(),
      supabase.from("saved_line_items").select("*").order("name").returns<SavedLineItem[]>(),
      supabase.from("subcontractor_logs").select("quoted_amount").eq("job_id", job.id),
      fetchHistoricalCostRange(job.types, job.calculated_sqft ?? null),
    ]);

    setMaterials(mats ?? []);
    setLaborLogs(labor ?? []);
    setSavedItems(saved ?? []);
    setSubTotal((subs ?? []).reduce((s, r) => s + Number(r.quoted_amount ?? 0), 0));
    setHistoricalRange(range);
    setLoading(false);
  }

  // ── Calculations ──────────────────────────────────────
  const materialsWithCost = materials.filter((m) => m.unit_cost !== null);
  const materialsTotal = materialsWithCost.reduce(
    (s, m) => s + m.quantity_ordered * Number(m.unit_cost),
    0
  );
  const laborTotal = laborLogs.reduce(
    (s, l) => s + Number(l.hours) * Number(l.rate),
    0
  );
  const baseSubtotal = materialsTotal + laborTotal + subTotal;
  const profitAmount = baseSubtotal * (margin / 100);
  const baseQuote = baseSubtotal + profitAmount;
  const addonsTotal = addons.reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const grandTotal = baseQuote + addonsTotal;
  const hasData = materialsTotal > 0 || laborTotal > 0 || subTotal > 0;

  // ── Addon helpers ─────────────────────────────────────
  function addBlankAddon() {
    setAddons((prev) => [...prev, { name: "", amount: 0 }]);
    setSaved(false);
  }

  function removeAddon(i: number) {
    setAddons((prev) => prev.filter((_, idx) => idx !== i));
    setSavedIdxSet((prev) => {
      const next = new Set(Array.from(prev));
      next.delete(i);
      return next;
    });
    setSaved(false);
  }

  function updateAddon(i: number, field: "name" | "amount", value: string | number) {
    setAddons((prev) =>
      prev.map((a, idx) => (idx === i ? { ...a, [field]: value } : a))
    );
    setSaved(false);
  }

  function addFromSaved(item: SavedLineItem) {
    setAddons((prev) => [...prev, { name: item.name, amount: item.amount }]);
    setSaved(false);
  }

  async function handleSaveItem(i: number) {
    const addon = addons[i];
    if (!addon.name.trim() || !addon.amount) return;
    setSavingItemIdx(i);
    const result = await saveLineItem(addon.name.trim(), Number(addon.amount));
    if (result.item) {
      setSavedItems((prev) =>
        [...prev, result.item!].sort((a, b) => a.name.localeCompare(b.name))
      );
      setSavedIdxSet((prev) => { const next = new Set(Array.from(prev)); next.add(i); return next; });
    }
    setSavingItemIdx(null);
  }

  // ── Share text ────────────────────────────────────────
  function buildShareText() {
    const validAddons = addons.filter((a) => a.name.trim() && Number(a.amount) > 0);
    const lines = [
      "QUOTE",
      `Generated ${today()} · Sightline`,
      "",
      job.name,
      job.address ?? "",
      "",
      `Materials:        ${fmt(materialsTotal)}`,
      `Labor:            ${fmt(laborTotal)}`,
      ...(subTotal > 0 ? [`Subcontractors:   ${fmt(subTotal)}`] : []),
    ];
    if (validAddons.length > 0) {
      lines.push("", "Add-Ons:");
      for (const a of validAddons) {
        lines.push(`  ${a.name}: ${fmt(Number(a.amount))}`);
      }
    }
    lines.push(
      "",
      `──────────────────────────`,
      `Profit (${margin}% on work): +${fmt(profitAmount)}`,
      `──────────────────────────`,
      `TOTAL:            ${fmt(grandTotal)}`
    );
    return lines.join("\n");
  }

  async function handleCopy() {
    try {
      if (navigator.share) {
        await navigator.share({ title: `Quote — ${job.name}`, text: buildShareText() });
      } else {
        await navigator.clipboard.writeText(buildShareText());
        setCopiedShare(true);
        setTimeout(() => setCopiedShare(false), 2500);
      }
    } catch {
      // dismissed
    }
  }

  async function handleDownloadPDF() {
    setPdfGenerating(true);
    try {
      const supabase = createClient();
      const [{ data: { user } }, { data: bp }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("business_profiles").select("business_name,owner_name,license_number,address,phone,email,logo_path").maybeSingle(),
      ]);

      let logoUrl: string | null = null;
      if (bp?.logo_path) {
        const { data: signed } = await supabase.storage
          .from("business-logos")
          .createSignedUrl(bp.logo_path, 300);
        logoUrl = signed?.signedUrl ?? null;
      }

      // Fetch signature data if signed
      let signatureData: string | null = null;
      if (isSigned && localEstimateId) {
        const { data: est } = await supabase
          .from("estimates")
          .select("signature_data")
          .eq("id", localEstimateId)
          .single();
        signatureData = est?.signature_data ?? null;
      }

      const validAddons = addons.filter((a) => a.name.trim() && Number(a.amount) > 0);
      await generateAndDownloadQuotePDF({
        contractorEmail: user?.email ?? "",
        jobName: job.name,
        jobAddress: job.address ?? "",
        jobTypes: job.types,
        jobNumber: job.job_number ?? undefined,
        date: today(),
        quoteNumber: `QUO-${job.id.slice(0, 8).toUpperCase()}`,
        materialsTotal,
        laborTotal,
        addons: validAddons.map((a) => ({ name: a.name, amount: Number(a.amount) })),
        profitMarginPct: margin,
        profitAmount,
        grandTotal,
        businessProfile: bp,
        logoUrl,
        signatureData,
        signedByName: localSignedByName,
        signedAt: localSignedAt
          ? new Date(localSignedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
          : null,
      });
    } finally {
      setPdfGenerating(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError("");
    const validAddons = addons.filter((a) => a.name.trim() && Number(a.amount) > 0);
    const result = await saveJobQuote({
      jobId: job.id,
      materialTotal: Math.round(materialsTotal),
      laborTotal: Math.round(laborTotal),
      profitMarginPct: margin,
      finalQuote: Math.round(baseQuote),
      addons: validAddons.map((a) => ({ name: a.name, amount: Number(a.amount) })),
    });
    if (result?.error) {
      setSaveError(result.error);
    } else {
      setSaved(true);
      if (result.estimateId) {
        setLocalEstimateId(result.estimateId);
        setLocalQuoteStatus("draft");
      }
      setAddons(validAddons);
      setQuoteData({
        materialBudget: Math.round(materialsTotal),
        laborBudget: Math.round(laborTotal),
        profitMarginPct: margin,
        finalQuote: Math.round(baseQuote),
        addons: validAddons.map((a) => ({ name: a.name, amount: Number(a.amount) })),
      });
    }
    setSaving(false);
  }

  // ── Profitability bar calculations ────────────────────
  const qd = quoteData;
  const qAddonsTotal = qd ? qd.addons.reduce((s, a) => s + a.amount, 0) : 0;
  const changeOrdersTotal = changeOrders.reduce((s, o) => s + Number(o.amount), 0);
  const totalQuote = qd ? qd.finalQuote + qAddonsTotal + changeOrdersTotal : 0;
  const totalActual = actualMaterialCost + actualLaborCost + actualSubCost;
  const profitBudget = qd ? totalQuote - qd.materialBudget - qd.laborBudget : 0;
  const profitRemaining = totalQuote - totalActual;
  const matZonePct = qd && totalQuote > 0 ? (qd.materialBudget / totalQuote) * 100 : 0;
  const labZonePct = qd && totalQuote > 0 ? (qd.laborBudget / totalQuote) * 100 : 0;
  const fillPct = qd && totalQuote > 0 ? Math.min((totalActual / totalQuote) * 100, 100) : 0;
  const hasActual = totalActual > 0;
  const isOverQuote = hasActual && totalActual >= totalQuote;
  const isOverBudget = hasActual && qd ? totalActual > qd.materialBudget + qd.laborBudget : false;

  let barStatus = "No costs logged yet";
  let statusColor = "text-gray-500";
  let fillHex = "#F97316";
  if (hasActual && qd) {
    if (isOverQuote) { barStatus = "Over budget"; statusColor = "text-red-400"; fillHex = "#ef4444"; }
    else if (isOverBudget) { barStatus = "Eating into margin"; statusColor = "text-yellow-400"; fillHex = "#eab308"; }
    else { barStatus = "On track"; statusColor = "text-orange-500"; fillHex = "#F97316"; }
  }

  const inputCls =
    "bg-[#1a1a1a] border border-[#2a2a2a] text-white text-sm px-3 rounded-lg min-h-[44px] placeholder-gray-600 focus:outline-none focus:border-orange-500";

  return (
    <>
      {/* ── TRIGGER / PROFITABILITY ─────────────────────── */}
      {!quoteData ? (
        <button
          onClick={handleOpen}
          className="w-full bg-orange-500 text-white font-bold text-lg py-4 rounded-xl active:scale-95 transition-transform"
        >
          Generate Quote
        </button>
      ) : (
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4">
          {/* Header row */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
              Profitability
            </p>
            <div className="flex items-center gap-3">
              {isSigned ? (
                <span className="flex items-center gap-1.5 text-xs font-bold text-green-400 bg-green-900/30 border border-green-800 px-2.5 py-1 rounded-lg">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                  Signed
                </span>
              ) : (
                <span className={`text-xs font-bold ${statusColor}`}>{barStatus}</span>
              )}
              {isSigned ? (
                <button
                  disabled
                  className="text-gray-600 text-xs font-semibold border border-[#2a2a2a] px-3 py-1.5 rounded-lg min-h-[36px] flex items-center gap-1.5 opacity-50 cursor-not-allowed"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                  Locked
                </button>
              ) : (
                <button
                  onClick={handleOpen}
                  className="text-gray-500 text-xs font-semibold border border-[#333] px-3 py-1.5 rounded-lg active:scale-95 transition-transform min-h-[36px]"
                >
                  Edit Quote
                </button>
              )}
            </div>
          </div>

          {/* Bar */}
          <div className="relative h-7 bg-[#242424] rounded-xl overflow-hidden">
            <div
              className="absolute top-0 bottom-0 bg-[#2a2a2a]"
              style={{ left: `${matZonePct + labZonePct}%`, right: 0 }}
            />
            <div
              className="absolute top-0 bottom-0 w-px bg-gray-500 z-10"
              style={{ left: `${matZonePct}%` }}
            />
            <div
              className="absolute top-0 bottom-0 w-px bg-gray-500 z-10"
              style={{ left: `${matZonePct + labZonePct}%` }}
            />
            {hasActual && (
              <div
                className="absolute top-0 left-0 bottom-0 transition-all duration-700"
                style={{ width: `${fillPct}%`, backgroundColor: fillHex }}
              />
            )}
          </div>

          {/* Zone labels */}
          <div className="relative h-5 mt-1">
            <span
              className="absolute text-gray-500 text-xs"
              style={{ left: `${matZonePct / 2}%`, transform: "translateX(-50%)" }}
            >
              Mat.
            </span>
            <span
              className="absolute text-gray-500 text-xs"
              style={{
                left: `${matZonePct + labZonePct / 2}%`,
                transform: "translateX(-50%)",
              }}
            >
              Labor
            </span>
            <span
              className="absolute text-gray-500 text-xs"
              style={{
                left: `${matZonePct + labZonePct + (100 - matZonePct - labZonePct) / 2}%`,
                transform: "translateX(-50%)",
              }}
            >
              Profit
            </span>
          </div>

          {/* Stats */}
          <div className="mt-3 flex flex-col gap-2 border-t border-[#2a2a2a] pt-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Materials logged</span>
              <span>
                <span
                  className={`font-semibold ${
                    isOverQuote ? "text-red-400" : isOverBudget ? "text-yellow-400" : "text-orange-500"
                  }`}
                >
                  ${Math.round(actualMaterialCost).toLocaleString()}
                </span>
                <span className="text-gray-500">
                  {" "}/ ${Math.round(qd!.materialBudget).toLocaleString()} est.
                </span>
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Labor logged</span>
              <span>
                <span
                  className={`font-semibold ${
                    isOverQuote ? "text-red-400" : isOverBudget ? "text-yellow-400" : "text-white"
                  }`}
                >
                  ${Math.round(actualLaborCost).toLocaleString()}
                </span>
                <span className="text-gray-500">
                  {" "}/ ${Math.round(qd!.laborBudget).toLocaleString()} est.
                </span>
              </span>
            </div>
            <div className="flex justify-between text-sm border-t border-[#2a2a2a] pt-2">
              <span className="text-gray-400">Total spent</span>
              <span className="text-white font-semibold">
                ${Math.round(totalActual).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Base quote</span>
              <span className="text-white font-semibold">
                ${Math.round(qd!.finalQuote + qAddonsTotal).toLocaleString()}
              </span>
            </div>
            {changeOrders.length > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Change orders ({changeOrders.length})</span>
                <span className={`font-semibold ${changeOrdersTotal >= 0 ? "text-orange-400" : "text-red-400"}`}>
                  {changeOrdersTotal >= 0 ? "+" : "−"}${Math.abs(Math.round(changeOrdersTotal)).toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">{changeOrders.length > 0 ? "Adjusted total" : "Total quote"}</span>
              <span className="text-white font-semibold">
                ${Math.round(totalQuote).toLocaleString()}
              </span>
            </div>
            <div
              className={`flex justify-between text-sm font-bold border-t border-[#2a2a2a] pt-2 ${
                profitRemaining < 0 ? "text-red-400" : "text-orange-500"
              }`}
            >
              <span>Profit remaining</span>
              <span>
                {profitRemaining < 0 ? "⚠ -" : ""}$
                {Math.abs(Math.round(profitRemaining)).toLocaleString()}
                {profitRemaining < 0 && (
                  <span className="text-xs font-normal text-red-400 ml-1">over budget</span>
                )}
              </span>
            </div>
            {profitBudget > 0 && (
              <div className="flex justify-between text-xs text-gray-600">
                <span>Target profit</span>
                <span>${Math.round(profitBudget).toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Signed info */}
          {isSigned && localSignedByName && (
            <div className="mt-3 pt-3 border-t border-[#2a2a2a] flex items-center justify-between">
              <div>
                <p className="text-green-400 text-xs font-semibold">
                  Signed by {localSignedByName}
                </p>
                {localSignedAt && (
                  <p className="text-gray-600 text-xs">
                    {new Date(localSignedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                )}
              </div>
              <button
                onClick={handleDuplicate}
                disabled={duplicating}
                className="text-gray-500 text-xs font-semibold border border-[#2a2a2a] px-3 py-2 rounded-lg active:scale-95 transition-transform min-h-[36px] disabled:opacity-50"
              >
                {duplicating ? "…" : "Duplicate Quote"}
              </button>
            </div>
          )}

          {/* Send for Signature button */}
          {!isSigned && quoteData && localEstimateId && (
            <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
              {sigError && (
                <p className="text-red-400 text-xs mb-2">{sigError}</p>
              )}
              <button
                onClick={handleSendForSignature}
                disabled={sending}
                className="w-full flex items-center justify-center gap-2 border border-orange-500/40 text-orange-400 font-semibold text-sm py-3 rounded-xl active:scale-95 transition-transform disabled:opacity-50 min-h-[48px]"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19l7-7-7-7"/><path d="M5 12h14"/>
                </svg>
                {sending ? "Generating link…" : localQuoteStatus === "sent" ? "Resend Signature Link" : "Send for Signature"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── QUOTE OVERLAY ───────────────────────────────── */}
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
              className="text-gray-400 text-3xl leading-none w-11 h-11 flex items-center justify-center active:scale-95"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-500 animate-pulse">Loading...</p>
            </div>
          ) : (
            <div className="flex-1 px-5 pb-8">
              {/* ── Quote document preview ── */}
              <div className="bg-[#141414] border border-[#242424] rounded-2xl overflow-hidden mb-6">
                <div className="px-5 py-5 border-b border-[#242424]">
                  <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-3">
                    {quoteData ? "Edit Quote" : "Quote"} · {today()}
                  </p>
                  <h2 className="text-white font-black text-2xl leading-tight mb-1">
                    {job.name}
                  </h2>
                  <p className="text-gray-400 text-sm">{job.address}</p>
                </div>

                <div className="px-5 py-5 flex flex-col gap-3">
                  {/* Materials */}
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-gray-300 font-semibold text-base">Materials</p>
                      {materialsWithCost.length > 0 && (
                        <p className="text-gray-500 text-xs mt-0.5">
                          {materialsWithCost.length} item
                          {materialsWithCost.length !== 1 ? "s" : ""} · auto
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

                  {/* Labor */}
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-gray-300 font-semibold text-base">Labor</p>
                      {laborLogs.length > 0 && (
                        <p className="text-gray-500 text-xs mt-0.5">
                          {laborLogs.length} entr{laborLogs.length !== 1 ? "ies" : "y"} · auto
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

                  {/* Subcontractors */}
                  {subTotal > 0 && (
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-gray-300 font-semibold text-base">Subcontractors</p>
                        <p className="text-gray-500 text-xs mt-0.5">quoted · auto</p>
                      </div>
                      <span className="text-white font-bold text-lg">{fmt(subTotal)}</span>
                    </div>
                  )}

                  {/* Add-on line items in preview */}
                  {addons.filter((a) => a.name && Number(a.amount) > 0).length > 0 && (
                    <div className="border-t border-[#2a2a2a] pt-3 flex flex-col gap-2">
                      <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">
                        Add-Ons
                      </p>
                      {addons
                        .filter((a) => a.name && Number(a.amount) > 0)
                        .map((a, i) => (
                          <div key={i} className="flex justify-between items-center">
                            <p className="text-gray-300 text-sm font-semibold">{a.name}</p>
                            <span className="text-white font-bold text-sm">
                              {fmt(Number(a.amount))}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Profit */}
                  <div className="flex justify-between items-center pt-3 border-t border-[#2a2a2a]">
                    <p className="text-gray-400 font-semibold text-base">
                      Profit{" "}
                      <span className="text-orange-500 font-bold">({margin}% on work)</span>
                    </p>
                    <span className="text-orange-500 font-bold text-lg">
                      +{fmt(profitAmount)}
                    </span>
                  </div>
                </div>

                {/* Grand Total */}
                <div className="bg-[#1a1a1a] border-t border-[#242424] px-5 py-6 flex justify-between items-center">
                  <p className="text-white font-black text-xl uppercase tracking-wide">Total</p>
                  <p className="text-orange-500 font-black text-4xl leading-none">
                    {fmt(grandTotal)}
                  </p>
                </div>
              </div>

              {/* Historical cost range banner */}
              {historicalRange && (() => {
                // Blend contractor's history with current estimate
                // Weight shifts toward history as job count grows
                const w = historicalRange.jobCount === 0 ? 0
                  : historicalRange.jobCount <= 3 ? 0.25
                  : historicalRange.jobCount <= 9 ? 0.50
                  : 0.70;
                const f = historicalRange.rangePct / 100;

                const matCenter = historicalRange.historicalMaterialAvg > 0
                  ? Math.round(historicalRange.historicalMaterialAvg * w + materialsTotal * (1 - w))
                  : materialsTotal;
                const labCenter = historicalRange.historicalLaborAvg > 0
                  ? Math.round(historicalRange.historicalLaborAvg * w + laborTotal * (1 - w))
                  : laborTotal;

                const matMin = Math.round(matCenter * (1 - f));
                const matMax = Math.round(matCenter * (1 + f));
                const labMin = Math.round(labCenter * (1 - f));
                const labMax = Math.round(labCenter * (1 + f));

                const hasMatRange = matCenter > 0;
                const hasLabRange = labCenter > 0;

                return (
                  <div className="mb-6 bg-[#1a1a1a] border border-orange-500/20 rounded-xl px-4 py-3">
                    <p className="text-orange-400 text-xs font-semibold uppercase tracking-wider mb-2">
                      📊 Estimate Range · ±{historicalRange.rangePct}%
                    </p>
                    <div className="flex gap-4 mb-2">
                      {hasMatRange && (
                        <div>
                          <p className="text-gray-500 text-xs">Materials</p>
                          <p className="text-white text-sm font-semibold">
                            {fmt(matMin)}–{fmt(matMax)}
                          </p>
                        </div>
                      )}
                      {hasLabRange && (
                        <div>
                          <p className="text-gray-500 text-xs">Labor</p>
                          <p className="text-white text-sm font-semibold">
                            {fmt(labMin)}–{fmt(labMax)}
                          </p>
                        </div>
                      )}
                    </div>
                    <p className="text-gray-600 text-xs leading-snug">
                      Based on {historicalRange.jobCount} job{historicalRange.jobCount !== 1 ? "s" : ""} in your history
                      {historicalRange.jobCount > 0 ? ` (${historicalRange.jobType})` : ""} — range narrows as you track more work
                    </p>
                  </div>
                );
              })()}

              {/* No data warning */}
              {!hasData && (
                <div className="mb-6 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3">
                  <p className="text-gray-500 text-sm text-center">
                    Add materials with unit costs and labor entries to populate this quote.
                  </p>
                </div>
              )}

              {/* ── Profit margin slider ── */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-gray-400 text-sm font-semibold uppercase tracking-wider">
                    Profit Margin
                  </p>
                  <span className="text-orange-500 font-black text-xl">{margin}%</span>
                </div>
                <input
                  type="range"
                  min={0}
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
                  <span>0%</span>
                  <span>50%</span>
                </div>
                {margin === 0 && (
                  <p className="text-red-400 text-xs mt-2 font-semibold">
                    No profit margin — you will break even on this job at best.
                  </p>
                )}
                {margin > 0 && margin < 10 && (
                  <p className="text-yellow-400 text-xs mt-2 font-semibold">
                    Low margin — consider your overhead costs.
                  </p>
                )}
              </div>

              {/* ── Add-On Line Items ── */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-gray-400 text-sm font-semibold uppercase tracking-wider">
                    Add-On Line Items
                  </p>
                  <button
                    onClick={addBlankAddon}
                    className="text-orange-500 font-bold text-sm px-3 py-2 border border-orange-500/30 rounded-lg active:scale-95 transition-transform min-h-[44px]"
                  >
                    + Add
                  </button>
                </div>

                {/* Saved items dropdown */}
                {savedItems.length > 0 && (
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const item = savedItems.find((si) => si.id === e.target.value);
                      if (item) {
                        addFromSaved(item);
                        e.target.value = "";
                      }
                    }}
                    className="w-full mb-3 bg-[#1A1A1A] border border-[#2a2a2a] text-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500"
                  >
                    <option value="">Add from saved items...</option>
                    {savedItems.map((si) => (
                      <option key={si.id} value={si.id}>
                        {si.name} — ${Number(si.amount).toLocaleString()}
                      </option>
                    ))}
                  </select>
                )}

                {addons.length === 0 ? (
                  <p className="text-gray-600 text-sm">
                    No line items yet. Add charges for permits, travel, upgrades, etc.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {addons.map((a, i) => (
                      <div
                        key={i}
                        className="bg-[#141414] border border-[#242424] rounded-xl px-4 py-3 flex flex-col gap-2"
                      >
                        {/* Name row */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={a.name}
                            onChange={(e) => updateAddon(i, "name", e.target.value)}
                            placeholder="Item name (e.g. Permit fee)"
                            className={inputCls + " flex-1"}
                          />
                          <button
                            onClick={() => removeAddon(i)}
                            className="text-gray-500 text-xl w-11 h-11 flex items-center justify-center active:scale-95 shrink-0"
                            aria-label="Remove"
                          >
                            ×
                          </button>
                        </div>

                        {/* Amount + Save row */}
                        <div className="flex gap-2">
                          <div className="flex items-center gap-2 flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 min-h-[44px]">
                            <span className="text-gray-500 text-sm shrink-0">$</span>
                            <input
                              type="number"
                              value={a.amount || ""}
                              onChange={(e) => updateAddon(i, "amount", e.target.value)}
                              placeholder="0"
                              min="0"
                              className="flex-1 bg-transparent text-white text-sm focus:outline-none"
                            />
                          </div>
                          <button
                            onClick={() => handleSaveItem(i)}
                            disabled={
                              savingItemIdx === i ||
                              !a.name.trim() ||
                              !Number(a.amount)
                            }
                            className={`shrink-0 px-3 py-2 rounded-lg text-xs font-semibold min-h-[44px] min-w-[64px] active:scale-95 transition-all border disabled:opacity-40 ${
                              savedIdxSet.has(i)
                                ? "text-green-400 border-green-800 bg-green-900/20"
                                : "text-gray-400 border-[#2a2a2a] bg-[#1a1a1a]"
                            }`}
                          >
                            {savingItemIdx === i
                              ? "..."
                              : savedIdxSet.has(i)
                              ? "✓ Saved"
                              : "Save"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Change Orders ── */}
              <ChangeOrdersSection jobId={job.id} />

              {/* ── Action buttons ── */}
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <button
                    onClick={handleCopy}
                    className="flex-1 flex items-center justify-center gap-2 bg-[#1A1A1A] border border-[#2a2a2a] text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform"
                  >
                    {copiedShare ? (
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

                {/* Send for Signature (in overlay) */}
                {localEstimateId && saved && (
                  <button
                    onClick={() => { setOpen(false); handleSendForSignature(); }}
                    disabled={sending}
                    className="w-full flex items-center justify-center gap-2 border border-orange-500/40 text-orange-400 font-bold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 19l7-7-7-7"/><path d="M5 12h14"/>
                    </svg>
                    Send for Signature
                  </button>
                )}

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
                    {saving
                      ? "Saving..."
                      : quoteData
                      ? "Update Quote"
                      : "Save Quote to Job"}
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

      {/* ── Signature link sheet ─────────────────────────── */}
      {sigSheetOpen && sigUrl && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60"
            onClick={() => setSigSheetOpen(false)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl px-5 pt-5"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
          >
            <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mb-5" />
            <h2 className="text-white font-bold text-xl mb-1">Signature Link Ready</h2>
            <p className="text-gray-500 text-sm mb-5">
              Share this link with your client to collect their digital signature.
            </p>
            <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-3 mb-4">
              <p className="text-gray-300 text-sm font-mono break-all">{sigUrl}</p>
            </div>
            <button
              onClick={handleCopySigUrl}
              className="w-full bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform"
            >
              {copied ? "✓ Copied!" : "Share / Copy Link"}
            </button>
          </div>
        </>
      )}
    </>
  );
}
