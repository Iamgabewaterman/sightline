"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveJobQuote, sendForSignature } from "@/app/actions/quotes";
import { fetchHistoricalCostRange } from "@/app/actions/insights";
import { Job, Material, LaborLog } from "@/types";
import InlineCalculatorDrawer from "@/components/InlineCalculatorDrawer";
import type { ResultItem } from "@/app/(dashboard)/calculator/calcs/types";
import { HistoricalCostRange } from "@/lib/insights";
import { useJobCost } from "@/components/JobCostContext";
import { useRole } from "@/hooks/useRole";
import LineItemBuilder, { LineItemRow, newLineItemRow, rowsToLineItems } from "@/components/LineItemBuilder";
import { upsertLineItemLabels } from "@/app/actions/line-items";

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
  const { actualMaterialCost, actualLaborCost, actualSubCost, quoteData, setQuoteData, changeOrders, quoteTrigger } = useJobCost();

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
      await navigator.clipboard.writeText(sigUrl);
      setCopiedSig(true);
      setTimeout(() => setCopiedSig(false), 2500);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = sigUrl;
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      try { document.execCommand("copy"); setCopiedSig(true); setTimeout(() => setCopiedSig(false), 2500); } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
  }

  async function handleShareSigUrl() {
    if (!sigUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Quote — ${job.name}`,
          text: `Here's your quote from ${job.name}. Review the details and sign to approve.`,
          url: sigUrl,
        });
      } catch { /* dismissed */ }
    } else {
      handleCopySigUrl();
    }
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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [copiedShare, setCopiedShare] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);

  // Display settings
  const [displayShowAddress, setDisplayShowAddress] = useState(true);
  const [displayShowValidUntil, setDisplayShowValidUntil] = useState(true);
  const [displayNotes, setDisplayNotes] = useState("");
  const [clientLineItems, setClientLineItems] = useState<LineItemRow[]>(() => [newLineItemRow()]);

  // Fetched data
  const [materials, setMaterials] = useState<Material[]>([]);
  const [laborLogs, setLaborLogs] = useState<LaborLog[]>([]);
  const [subTotal, setSubTotal] = useState(0);
  const [receiptsTotal, setReceiptsTotal] = useState(0);

  // Internal cost reference UI
  const [costRefOpen, setCostRefOpen] = useState(false);
  const [calcDrawerOpen, setCalcDrawerOpen] = useState(false);
  const [calcEstimates, setCalcEstimates] = useState<{ label: string; amount: number }[]>([]);

  // Historical cost range banner
  const [historicalRange, setHistoricalRange] = useState<HistoricalCostRange | null>(null);

  async function handleOpen() {
    setOpen(true);
    setSaved(false);
    setSaveError("");
    setLoading(true);

    const supabase = createClient();
    const [{ data: mats }, { data: labor }, { data: subs }, { data: rcpts }, range] = await Promise.all([
      supabase.from("materials").select("*").eq("job_id", job.id).returns<Material[]>(),
      supabase.from("labor_logs").select("*").eq("job_id", job.id).returns<LaborLog[]>(),
      supabase.from("subcontractor_logs").select("quoted_amount").eq("job_id", job.id),
      supabase.from("receipts").select("amount").eq("job_id", job.id),
      fetchHistoricalCostRange(job.types, job.calculated_sqft ?? null),
    ]);

    setMaterials(mats ?? []);
    setLaborLogs(labor ?? []);
    setSubTotal((subs ?? []).reduce((s, r) => s + Number(r.quoted_amount ?? 0), 0));
    setReceiptsTotal((rcpts ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0));
    setCalcEstimates([]);
    setHistoricalRange(range);

    // Default Section 1 to one "Professional Services" row with the suggested
    // total (internal cost grossed up to a 20% margin). Overridden below if the
    // saved estimate already has client line items.
    const matTot = (mats ?? []).filter((m) => m.unit_cost !== null).reduce((s, m) => s + m.quantity_ordered * Number(m.unit_cost), 0);
    const labTot = (labor ?? []).reduce((s, l) => s + Number(l.hours) * Number(l.rate), 0);
    const suggested = matTot + labTot > 0 ? Math.round((matTot + labTot) / 0.8) : 0;
    setClientLineItems([{
      id: Math.random().toString(36).slice(2),
      name: "Professional Services",
      amount: suggested ? suggested.toString() : "",
    }]);

    // Load display settings from DB if estimate exists
    if (localEstimateId) {
      const { data: est } = await supabase
        .from("estimates")
        .select("quote_display_show_address, quote_display_show_valid_until, quote_display_collapse_to_total, quote_display_notes, quote_client_line_items")
        .eq("id", localEstimateId)
        .single();
      if (est) {
        setDisplayShowAddress(est.quote_display_show_address ?? true);
        setDisplayShowValidUntil(est.quote_display_show_valid_until ?? true);
        setDisplayNotes(est.quote_display_notes ?? "");
        const savedRows = (est.quote_client_line_items as { name: string; amount: number }[] | null) ?? [];
        if (savedRows.length > 0) {
          setClientLineItems(savedRows.map((x) => ({ id: Math.random().toString(36).slice(2), name: x.name, amount: x.amount.toString() })));
        }
      }
    }

    setLoading(false);
  }

  // Open the quote builder when "Generate Quote" is tapped in quick actions.
  useEffect(() => {
    if (quoteTrigger > 0) handleOpen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteTrigger]);

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
  const hasData = materialsTotal > 0 || laborTotal > 0 || subTotal > 0;

  // ── New 3-section model ───────────────────────────────
  // Section 2 — internal cost basis used to compute margin (reference only,
  // never shown to the client). Receipts are shown for reference but excluded
  // from the basis to avoid double-counting logged materials.
  const calcEstimatesTotal = calcEstimates.reduce((s, c) => s + c.amount, 0);
  const costBasis = materialsTotal + laborTotal + subTotal + calcEstimatesTotal;

  // Section 1 — the client-facing line items ARE the quote total.
  const quoteTotal = clientLineItems.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

  // Section 3 — gross margin, updating in real time.
  const marginPct = quoteTotal > 0 ? ((quoteTotal - costBasis) / quoteTotal) * 100 : 0;
  const marginColor = marginPct >= 20 ? "text-green-400" : marginPct >= 10 ? "text-yellow-400" : "text-red-400";
  const marginBarColor = marginPct >= 20 ? "#22c55e" : marginPct >= 10 ? "#eab308" : "#ef4444";

  // Editing the headline total adjusts the first line item so the rows still sum
  // to the entered total (lets the contractor "enter total directly").
  function setQuoteTotalDirect(value: string) {
    const target = parseFloat(value) || 0;
    setClientLineItems((rows) => {
      if (rows.length === 0) {
        return [{ id: Math.random().toString(36).slice(2), name: "Professional Services", amount: target ? target.toString() : "" }];
      }
      const othersTotal = rows.slice(1).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
      const firstAmount = Math.max(0, target - othersTotal);
      return rows.map((r, i) => (i === 0 ? { ...r, amount: firstAmount ? firstAmount.toString() : "" } : r));
    });
    setSaved(false);
  }

  function addCalcEstimate(label: string, amount: number) {
    setCalcEstimates((prev) => [...prev, { label, amount: Math.round(amount) }]);
    setCostRefOpen(true);
    setSaved(false);
  }

  // Margin slider drives the total the other way: total = cost ÷ (1 − margin%).
  // Needs a cost basis to compute from; the headline total stays editable too.
  function setMarginTarget(marginValue: number) {
    if (costBasis <= 0) return;
    const m = Math.min(95, Math.max(0, marginValue)) / 100;
    const target = Math.round(costBasis / (1 - m));
    setQuoteTotalDirect(String(target));
  }

  // ── Share text ────────────────────────────────────────
  function buildShareText() {
    const rows = rowsToLineItems(clientLineItems);
    const lines = [
      "QUOTE",
      `Generated ${today()} · Sightline`,
      "",
      job.name,
      job.address ?? "",
      "",
    ];
    for (const r of rows) {
      lines.push(`${r.name}: ${fmt(r.amount)}`);
    }
    lines.push(
      `──────────────────────────`,
      `TOTAL:            ${fmt(quoteTotal)}`
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

      const { generateAndDownloadQuotePDF } = await import("@/lib/generateQuotePDF");
      await generateAndDownloadQuotePDF({
        contractorEmail: user?.email ?? "",
        jobName: job.name,
        jobAddress: job.address ?? "",
        jobTypes: job.types,
        jobNumber: job.job_number ?? undefined,
        date: today(),
        quoteNumber: `QUO-${job.id.slice(0, 8).toUpperCase()}`,
        grandTotal: quoteTotal,
        addons: [],
        businessProfile: bp,
        logoUrl,
        showAddress: displayShowAddress,
        showValidUntil: displayShowValidUntil,
        notes: displayNotes.trim() || null,
        clientLineItems: rowsToLineItems(clientLineItems),

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
    const roundedMargin = Math.round(marginPct);
    const result = await saveJobQuote({
      jobId: job.id,
      materialTotal: Math.round(materialsTotal),
      laborTotal: Math.round(laborTotal),
      profitMarginPct: roundedMargin,
      finalQuote: Math.round(quoteTotal),
      addons: [],
      displayShowAddress,
      displayShowValidUntil,
      displayNotes: displayNotes.trim() || null,
      clientLineItems: rowsToLineItems(clientLineItems),
    });
    if (result?.error) {
      setSaveError(result.error);
    } else {
      const labelNames = clientLineItems.map((r) => r.name).filter(Boolean);
      if (labelNames.length) upsertLineItemLabels(labelNames);
      setSaved(true);
      if (result.estimateId) {
        setLocalEstimateId(result.estimateId);
        setLocalQuoteStatus("draft");
      }
      setQuoteData({
        materialBudget: Math.round(materialsTotal),
        laborBudget: Math.round(laborTotal),
        profitMarginPct: roundedMargin,
        finalQuote: Math.round(quoteTotal),
        addons: [],
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
  const actualMarginPct = totalQuote > 0 ? (profitRemaining / totalQuote) * 100 : 0;
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
    else { barStatus = "On track"; statusColor = "text-green-400"; fillHex = "#22c55e"; }
  }

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
                  className="text-gray-600 text-xs font-semibold border border-[#2a2a2a] px-3 py-2.5 rounded-lg min-h-[48px] flex items-center gap-1.5 opacity-50 cursor-not-allowed"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                  Locked
                </button>
              ) : (
                <button
                  onClick={handleOpen}
                  className="text-gray-500 text-xs font-semibold border border-[#333] px-3 py-2.5 rounded-lg active:scale-95 transition-transform min-h-[48px]"
                >
                  Edit Quote
                </button>
              )}
            </div>
          </div>

          {/* Progress bar */}
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
              style={{ left: `${matZonePct + labZonePct / 2}%`, transform: "translateX(-50%)" }}
            >
              Labor
            </span>
            <span
              className="absolute text-gray-500 text-xs"
              style={{ left: `${matZonePct + labZonePct + (100 - matZonePct - labZonePct) / 2}%`, transform: "translateX(-50%)" }}
            >
              Profit
            </span>
          </div>

          {/* Cost report table */}
          <div className="mt-4 border border-[#2a2a2a] rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto] bg-[#111] px-3 py-2 gap-x-3">
              <span className="text-gray-600 text-[10px] font-bold uppercase tracking-wider">Category</span>
              <span className="text-gray-600 text-[10px] font-bold uppercase tracking-wider text-right w-[72px]">Quoted</span>
              <span className="text-gray-600 text-[10px] font-bold uppercase tracking-wider text-right w-[72px]">Actual</span>
              <span className="text-gray-600 text-[10px] font-bold uppercase tracking-wider text-right w-[52px]">Status</span>
            </div>
            {/* Materials row */}
            {(() => {
              const v = actualMaterialCost - qd!.materialBudget;
              const has = actualMaterialCost > 0;
              const pct = has && qd!.materialBudget > 0 ? (v / qd!.materialBudget) * 100 : 0;
              const statusColor = !has ? "text-gray-600" : v <= 0 ? "text-green-400" : pct <= 20 ? "text-yellow-400" : "text-red-400";
              return (
                <div className="grid grid-cols-[1fr_auto_auto_auto] px-3 py-2.5 gap-x-3 border-t border-[#1e1e1e]">
                  <span className="text-gray-300 text-sm">Materials</span>
                  <span className="text-gray-400 text-sm text-right w-[72px]">${Math.round(qd!.materialBudget).toLocaleString()}</span>
                  <span className={`text-sm text-right w-[72px] font-semibold ${has ? (v > 0 ? "text-red-400" : "text-white") : "text-gray-600"}`}>
                    {has ? "$" + Math.round(actualMaterialCost).toLocaleString() : "—"}
                  </span>
                  <span className={`text-xs text-right w-[52px] font-bold ${statusColor}`}>
                    {has ? (v > 0 ? "Over" : "Under") : "—"}
                  </span>
                </div>
              );
            })()}
            {/* Labor row */}
            {(() => {
              const v = actualLaborCost - qd!.laborBudget;
              const has = actualLaborCost > 0;
              const pct = has && qd!.laborBudget > 0 ? (v / qd!.laborBudget) * 100 : 0;
              const statusColor = !has ? "text-gray-600" : v <= 0 ? "text-green-400" : pct <= 20 ? "text-yellow-400" : "text-red-400";
              return (
                <div className="grid grid-cols-[1fr_auto_auto_auto] px-3 py-2.5 gap-x-3 border-t border-[#1e1e1e]">
                  <span className="text-gray-300 text-sm">Labor</span>
                  <span className="text-gray-400 text-sm text-right w-[72px]">${Math.round(qd!.laborBudget).toLocaleString()}</span>
                  <span className={`text-sm text-right w-[72px] font-semibold ${has ? (v > 0 ? "text-red-400" : "text-white") : "text-gray-600"}`}>
                    {has ? "$" + Math.round(actualLaborCost).toLocaleString() : "—"}
                  </span>
                  <span className={`text-xs text-right w-[52px] font-bold ${statusColor}`}>
                    {has ? (v > 0 ? "Over" : "Under") : "—"}
                  </span>
                </div>
              );
            })()}
            {/* Change orders row */}
            {changeOrders.length > 0 && (
              <div className="grid grid-cols-[1fr_auto_auto_auto] px-3 py-2.5 gap-x-3 border-t border-[#1e1e1e]">
                <span className="text-gray-400 text-sm">Change Orders ({changeOrders.length})</span>
                <span className={`text-sm text-right w-[72px] font-semibold ${changeOrdersTotal >= 0 ? "text-orange-400" : "text-red-400"}`}>
                  {changeOrdersTotal >= 0 ? "+" : "−"}${Math.abs(Math.round(changeOrdersTotal)).toLocaleString()}
                </span>
                <span className="text-gray-600 text-sm text-right w-[72px]">—</span>
                <span className="text-gray-600 text-xs text-right w-[52px]">—</span>
              </div>
            )}
            {/* Total row */}
            {(() => {
              const v = totalActual - totalQuote;
              const pct = hasActual && totalQuote > 0 ? (v / totalQuote) * 100 : 0;
              const statusColor = !hasActual ? "text-gray-600" : v <= 0 ? "text-green-400" : pct <= 20 ? "text-yellow-400" : "text-red-400";
              return (
                <div className="grid grid-cols-[1fr_auto_auto_auto] px-3 py-2.5 gap-x-3 border-t border-[#2a2a2a] bg-[#111]">
                  <span className="text-white font-bold text-sm">Total</span>
                  <span className="text-gray-300 font-bold text-sm text-right w-[72px]">${Math.round(totalQuote).toLocaleString()}</span>
                  <span className={`text-sm text-right w-[72px] font-bold ${hasActual ? (v > 0 ? "text-red-400" : "text-white") : "text-gray-600"}`}>
                    {hasActual ? "$" + Math.round(totalActual).toLocaleString() : "—"}
                  </span>
                  <span className={`text-xs text-right w-[52px] font-bold ${statusColor}`}>
                    {hasActual ? (v > 0 ? "Over" : "Under") : "—"}
                  </span>
                </div>
              );
            })()}
          </div>

          {/* Divider */}
          <div className="border-t border-[#2a2a2a] mt-5 mb-4" />

          {/* Profit remaining */}
          <div className="flex justify-between items-start mb-1">
            <span className="text-gray-400 text-sm font-semibold">Profit remaining</span>
            <span className={`font-bold text-lg ${profitRemaining < 0 ? "text-red-400" : "text-orange-500"}`}>
              {profitRemaining < 0 ? "−" : ""}${Math.abs(Math.round(profitRemaining)).toLocaleString()}
            </span>
          </div>
          {profitBudget > 0 && (
            <p className="text-gray-600 text-xs text-right mb-4">target ${Math.round(profitBudget).toLocaleString()}</p>
          )}

          {/* Three stats */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-[#111] rounded-xl px-2 py-3 text-center">
              <p className="text-gray-600 text-[10px] font-bold uppercase tracking-wider mb-1.5">Quoted Margin</p>
              <p className="text-white font-bold text-sm">{qd!.profitMarginPct}%</p>
            </div>
            <div className="bg-[#111] rounded-xl px-2 py-3 text-center">
              <p className="text-gray-600 text-[10px] font-bold uppercase tracking-wider mb-1.5">Actual Margin</p>
              <p className={`font-bold text-sm ${!hasActual ? "text-gray-600" : actualMarginPct < 0 ? "text-red-400" : actualMarginPct >= qd!.profitMarginPct ? "text-green-400" : "text-yellow-400"}`}>
                {hasActual ? actualMarginPct.toFixed(1) + "%" : "—"}
              </p>
            </div>
            <div className="bg-[#111] rounded-xl px-2 py-3 text-center">
              <p className="text-gray-600 text-[10px] font-bold uppercase tracking-wider mb-1.5">Actual Profit</p>
              <p className={`font-bold text-sm ${!hasActual ? "text-gray-600" : profitRemaining < 0 ? "text-red-400" : "text-orange-500"}`}>
                {hasActual ? (profitRemaining < 0 ? "−" : "") + "$" + Math.abs(Math.round(profitRemaining)).toLocaleString() : "—"}
              </p>
            </div>
          </div>

          {/* Signed info */}
          {isSigned && localSignedByName && (
            <div className="pt-3 border-t border-[#2a2a2a] flex items-center justify-between">
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
                className="text-gray-500 text-xs font-semibold border border-[#2a2a2a] px-3 py-2 rounded-lg active:scale-95 transition-transform min-h-[48px] disabled:opacity-50"
              >
                {duplicating ? "…" : "Duplicate Quote"}
              </button>
            </div>
          )}

          {/* Resend Signature Link */}
          {!isSigned && quoteData && localEstimateId && (
            <div className="pt-4 border-t border-[#2a2a2a]">
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
              {/* Doc header */}
              <div className="mb-5">
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">
                  {quoteData ? "Edit Quote" : "New Quote"} · {today()}
                </p>
                <h2 className="text-white font-black text-2xl leading-tight">{job.name}</h2>
                <p className="text-gray-400 text-sm">{job.address}</p>
              </div>

              {/* ── SECTION 1 — Client-facing line items ── */}
              <div className="mb-6">
                <p className="text-gray-400 text-sm font-semibold uppercase tracking-wider">1 · Client Line Items</p>
                <p className="text-gray-600 text-xs mt-0.5 mb-3">What the client sees on the quote. Every field is editable.</p>
                <LineItemBuilder
                  items={clientLineItems}
                  onItemsChange={(items) => { setClientLineItems(items); setSaved(false); }}
                  totalToMatch={0}
                />
              </div>

              {/* ── SECTION 2 — Internal cost reference (collapsed) ── */}
              <div className="mb-6 bg-[#141414] border border-[#242424] rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setCostRefOpen((o) => !o)}
                  className="w-full flex items-center justify-between px-4 py-3.5 active:opacity-80"
                >
                  <div className="text-left">
                    <p className="text-gray-400 text-sm font-semibold uppercase tracking-wider">2 · Internal Cost Reference</p>
                    <p className="text-gray-600 text-xs mt-0.5">Your costs — never shown to the client</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-white font-bold text-sm">{fmt(costBasis)}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                      className="text-gray-500" style={{ transform: costRefOpen ? "rotate(180deg)" : "none", transition: "transform 0.18s" }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </button>
                {costRefOpen && (
                  <div className="border-t border-[#242424] px-4 py-3 flex flex-col gap-2.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Logged materials</span>
                      <span className="text-gray-200 font-semibold">{fmt(materialsTotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Logged labor</span>
                      <span className="text-gray-200 font-semibold">{fmt(laborTotal)}</span>
                    </div>
                    {subTotal > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Subcontractors (quoted)</span>
                        <span className="text-gray-200 font-semibold">{fmt(subTotal)}</span>
                      </div>
                    )}
                    {calcEstimates.map((c, i) => (
                      <div key={i} className="flex justify-between items-center text-sm">
                        <span className="text-gray-400 flex items-center gap-1.5">
                          <span className="text-orange-500/70 text-xs">📐</span> {c.label}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-gray-200 font-semibold">{fmt(c.amount)}</span>
                          <button
                            type="button"
                            onClick={() => { setCalcEstimates((prev) => prev.filter((_, idx) => idx !== i)); setSaved(false); }}
                            className="text-gray-600 active:text-red-400 text-base leading-none"
                            aria-label="Remove estimate"
                          >×</button>
                        </span>
                      </div>
                    ))}
                    {receiptsTotal > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600">Receipts logged (reference)</span>
                        <span className="text-gray-600">{fmt(receiptsTotal)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm pt-2 border-t border-[#242424]">
                      <span className="text-gray-300 font-bold">Internal cost basis</span>
                      <span className="text-white font-bold">{fmt(costBasis)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCalcDrawerOpen(true)}
                      className="mt-1 w-full flex items-center justify-center gap-2 border border-orange-500/40 text-orange-400 font-semibold text-sm py-3 rounded-xl active:scale-95 transition-transform min-h-[48px]"
                    >
                      <span>📐</span> Pull from Calculator
                    </button>
                  </div>
                )}
              </div>

              {/* ── SECTION 3 — Margin & total ── */}
              <div className="mb-6 bg-[#141414] border border-[#242424] rounded-2xl px-5 py-5">
                <p className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-3">3 · Quote Total & Margin</p>
                <div className="flex items-center gap-1.5 mb-4">
                  <span className="text-orange-500 font-black text-3xl leading-none">$</span>
                  <input
                    inputMode="decimal"
                    value={quoteTotal ? String(Math.round(quoteTotal)) : ""}
                    onChange={(e) => setQuoteTotalDirect(e.target.value)}
                    placeholder="0"
                    className="flex-1 min-w-0 bg-transparent text-orange-500 font-black text-4xl leading-none focus:outline-none placeholder-orange-500/30"
                  />
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm font-semibold">Margin</span>
                  <span className={`font-black text-2xl ${marginColor}`}>{marginPct.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-[#242424] rounded-full overflow-hidden">
                  <div className="h-full transition-all duration-300" style={{ width: `${Math.max(0, Math.min(100, marginPct))}%`, backgroundColor: marginBarColor }} />
                </div>
                {/* Margin slider — drag to set the total from your cost basis */}
                {costBasis > 0 && (
                  <div className="mt-3">
                    <input
                      type="range"
                      min={0}
                      max={60}
                      step={1}
                      value={Math.round(Math.max(0, Math.min(60, marginPct)))}
                      onChange={(e) => setMarginTarget(Number(e.target.value))}
                      className="range-slider w-full"
                      aria-label="Profit margin"
                    />
                    <div className="flex justify-between text-gray-600 text-[10px] mt-0.5">
                      <span>0%</span><span>30%</span><span>60%</span>
                    </div>
                  </div>
                )}
                <p className="text-gray-600 text-xs mt-2">
                  {costBasis > 0
                    ? `Cost basis ${fmt(costBasis)} · profit ${fmt(quoteTotal - costBasis)} · drag the slider or type a total above`
                    : "Add costs in the reference above to see your margin"}
                </p>
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

              {/* ── Quote Display Settings ── */}
              <div className="mb-6">
                <p className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-4">
                  Quote Display Settings
                </p>
                <p className="text-gray-600 text-xs mb-4 leading-snug">
                  Controls what the client sees on the signature page and PDF. Your internal numbers are never shown.
                </p>

                {/* Toggles */}
                <div className="flex flex-col gap-3 mb-4">
                  {[
                    { label: "Show job address", value: displayShowAddress, set: setDisplayShowAddress },
                    { label: "Show valid until date", value: displayShowValidUntil, set: setDisplayShowValidUntil },
                  ].map(({ label, value, set }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => { set(!value); setSaved(false); }}
                      className="flex items-center justify-between bg-[#141414] border border-[#242424] rounded-xl px-4 py-3 active:scale-[0.99] transition-transform"
                    >
                      <span className="text-gray-300 text-sm font-medium">{label}</span>
                      <div className={`w-11 h-6 rounded-full flex items-center transition-colors ${value ? "bg-orange-500" : "bg-[#2a2a2a]"}`}>
                        <div className={`w-5 h-5 rounded-full bg-white mx-0.5 transition-transform ${value ? "translate-x-5" : "translate-x-0"}`} />
                      </div>
                    </button>
                  ))}
                </div>

                {/* Notes / Terms */}
                <div>
                  <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">Notes & Terms</p>
                  <textarea
                    value={displayNotes}
                    onChange={(e) => { setDisplayNotes(e.target.value); setSaved(false); }}
                    placeholder="Add payment terms, scope notes, or conditions for the client..."
                    rows={4}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white text-sm px-3 py-3 rounded-lg placeholder-gray-600 focus:outline-none focus:border-orange-500 resize-none"
                  />
                </div>
              </div>

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
            <div className="flex gap-3">
              <button
                onClick={handleCopySigUrl}
                className="flex-1 flex items-center justify-center gap-2 bg-[#1A1A1A] border border-[#2a2a2a] text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                {copied ? "✓ Copied!" : "Copy Link"}
              </button>
              <button
                onClick={handleShareSigUrl}
                className="flex-1 flex items-center justify-center gap-2 bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                Share
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Inline calculator drawer (Pull from Calculator) ── */}
      <InlineCalculatorDrawer
        open={calcDrawerOpen}
        onClose={() => setCalcDrawerOpen(false)}
        title="Pull from Calculator"
        addLabel="Add to Cost Reference"
        onAddResult={(items: ResultItem[], tradeLabel: string) => {
          const est = items.reduce((s, i) => s + i.unitCost * i.qty, 0);
          addCalcEstimate(tradeLabel, est);
        }}
      />
    </>
  );
}
