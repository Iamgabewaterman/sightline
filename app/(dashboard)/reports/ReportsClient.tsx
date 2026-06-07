"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchReportData,
  saveReportTemplate,
  deleteReportTemplate,
} from "@/app/actions/reports";
import { generateAndDownloadReportPDF } from "@/lib/generateReportPDF";
import type {
  ReportType,
  DatePreset,
  JobFilterType,
  ReportConfig,
  ReportTemplate,
  ReportResult,
} from "./types";
import {
  REPORT_TYPE_CONFIG,
  DATE_PRESET_LABELS,
  JOB_TYPES,
  CUSTOM_SECTION_OPTIONS,
  LEGACY_TYPE_MAP,
  resolveDateRange,
} from "./types";
import type { BusinessProfile } from "@/types";

// ── Props ─────────────────────────────────────────────────────────────────────

interface JobStub {
  id: string;
  name: string;
  job_number: string | null;
  types: string[] | null;
  status: string | null;
}

interface Props {
  jobs: JobStub[];
  savedTemplates: ReportTemplate[];
  businessProfile: BusinessProfile | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function migrateConfig(c: ReportConfig): ReportConfig {
  const rt = (LEGACY_TYPE_MAP[c.reportType as string] ?? c.reportType) as ReportType;
  return { ...c, reportType: rt };
}

function buildCsvContent(rows: Record<string, unknown>[], colKeys: string[], colLabels: string[]): string {
  const header = colLabels.map(l => `"${l}"`).join(",");
  const body   = rows.map(row =>
    colKeys.map(k => {
      const v = row[k];
      return v == null ? '""' : `"${String(v).replace(/"/g, '""')}"`;
    }).join(",")
  ).join("\n");
  return header + "\n" + body;
}

function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ReportsClient({ jobs, savedTemplates: initTemplates, businessProfile }: Props) {

  // ── Config state ─────────────────────────────────────────────────────────────
  const [reportType,      setReportType]      = useState<ReportType>("job_profitability");
  const [datePreset,      setDatePreset]       = useState<DatePreset>("this_year");
  const [dateStart,       setDateStart]        = useState("");
  const [dateEnd,         setDateEnd]          = useState("");
  const [jobFilterType,   setJobFilterType]    = useState<JobFilterType>("all");
  const [jobFilterValues, setJobFilterValues]  = useState<string[]>([]);
  const [selectedCols,    setSelectedCols]     = useState<string[]>(() =>
    REPORT_TYPE_CONFIG["job_profitability"].columns.map(c => c.key)
  );
  const [customSections,  setCustomSections]   = useState<ReportType[]>(["job_profitability", "materials_cost", "invoices_payments"]);
  const [includeWatermark, setIncludeWatermark] = useState(false);

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [templates,       setTemplates]        = useState<ReportTemplate[]>(initTemplates);
  const [previewResult,   setPreviewResult]    = useState<ReportResult | null>(null);
  const [previewLoading,  setPreviewLoading]   = useState(false);
  const [exporting,       setExporting]        = useState(false);
  const [saveOpen,        setSaveOpen]         = useState(false);
  const [templateName,    setTemplateName]      = useState("");
  const [saving,          setSaving]           = useState(false);
  const [jobSearch,       setJobSearch]        = useState("");
  const [toast,           setToast]            = useState("");
  const [toastOk,         setToastOk]          = useState(true);

  const debounceRef  = useRef<ReturnType<typeof setTimeout>>();
  const requestIdRef = useRef(0);

  const showToast = (msg: string, ok = true) => {
    setToast(msg); setToastOk(ok);
    setTimeout(() => setToast(""), 3000);
  };

  // ── Sync columns when report type changes ─────────────────────────────────
  useEffect(() => {
    if (reportType === "custom") return;
    setSelectedCols(REPORT_TYPE_CONFIG[reportType].columns.map(c => c.key));
  }, [reportType]);

  useEffect(() => { setJobFilterValues([]); }, [jobFilterType]);

  // ── Build config ─────────────────────────────────────────────────────────────
  const buildConfig = useCallback((): ReportConfig => ({
    reportType,
    datePreset,
    dateStart: datePreset === "custom" ? dateStart : undefined,
    dateEnd:   datePreset === "custom" ? dateEnd   : undefined,
    jobFilterType,
    jobFilterValues,
    columns:        reportType === "custom" ? [] : selectedCols,
    exportFormat:   "csv",
    customSections: reportType === "custom" ? customSections : undefined,
    includeWatermark,
  }), [reportType, datePreset, dateStart, dateEnd, jobFilterType, jobFilterValues, selectedCols, customSections, includeWatermark]);

  // ── Derived ───────────────────────────────────────────────────────────────────
  const allCols    = reportType === "custom" ? [] : REPORT_TYPE_CONFIG[reportType].columns;
  const activeCols = allCols.filter(c => selectedCols.includes(c.key));

  // ── Live preview with debounce ────────────────────────────────────────────────
  const configKey = [
    reportType, datePreset, dateStart, dateEnd,
    jobFilterType, jobFilterValues.join(","),
    selectedCols.join(","), customSections.join(","),
  ].join("|");

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const thisId = ++requestIdRef.current;
      setPreviewLoading(true);
      const result = await fetchReportData(buildConfig());
      if (thisId !== requestIdRef.current) return;
      setPreviewLoading(false);
      if (result.error) { showToast(result.error, false); return; }
      setPreviewResult(result);
    }, 800);
    return () => clearTimeout(debounceRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey]);

  // ── Export ────────────────────────────────────────────────────────────────────
  async function runExport(format: "pdf" | "csv") {
    setExporting(true);
    try {
      const result = await fetchReportData(buildConfig());
      if (result.error) { showToast(result.error, false); return; }

      const resolved = resolveDateRange(datePreset, dateStart, dateEnd);
      const label    = datePreset === "custom"
        ? `${dateStart} – ${dateEnd}`
        : `${resolved.start} – ${resolved.end}`;
      const today    = new Date().toISOString().split("T")[0];
      const title    = REPORT_TYPE_CONFIG[reportType].label;
      const slug     = title.replace(/\s+/g, "-").toLowerCase();

      if (format === "csv") {
        if (result.sections && result.sections.length > 0) {
          let csv = "";
          result.sections.forEach(sec => {
            const secCols = REPORT_TYPE_CONFIG[sec.type]?.columns ?? [];
            const keys    = secCols.map(c => c.key);
            const labels  = secCols.map(c => c.label);
            csv += `\n"${sec.title}"\n` + buildCsvContent(sec.rows, keys, labels) + "\n";
          });
          triggerDownload(csv.trim(), `${slug}-${today}.csv`, "text/csv");
        } else {
          const keys   = activeCols.map(c => c.key);
          const labels = activeCols.map(c => c.label);
          triggerDownload(buildCsvContent(result.rows, keys, labels), `${slug}-${today}.csv`, "text/csv");
        }
        showToast("CSV downloaded");
        return;
      }

      // PDF
      let logoUrl: string | null = null;
      if (businessProfile?.logo_path) {
        const supabase = createClient();
        const { data: signed } = await supabase.storage
          .from("business-logos")
          .createSignedUrl(businessProfile.logo_path, 300);
        logoUrl = signed?.signedUrl ?? null;
      }

      if (result.sections && result.sections.length > 0) {
        const sections = result.sections.map(sec => ({
          title:   sec.title,
          columns: REPORT_TYPE_CONFIG[sec.type]?.columns ?? [],
          rows:    sec.rows,
        }));
        await generateAndDownloadReportPDF({
          reportTitle: title, dateRangeLabel: label, generatedDate: today,
          businessProfile, logoUrl, columns: [], rows: [], sections,
          includeWatermark, totalRows: result.totalRows,
        });
      } else {
        await generateAndDownloadReportPDF({
          reportTitle: title, dateRangeLabel: label, generatedDate: today,
          businessProfile, logoUrl, columns: activeCols, rows: result.rows,
          includeWatermark, totalRows: result.totalRows,
        });
      }
      showToast("PDF downloaded");
    } finally {
      setExporting(false);
    }
  }

  // ── Templates ─────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!templateName.trim()) return;
    setSaving(true);
    const result = await saveReportTemplate(templateName.trim(), buildConfig());
    setSaving(false);
    if (result.error) { showToast(result.error, false); return; }
    setTemplates(prev => [{
      id: result.id!, user_id: "", name: templateName.trim(),
      config: buildConfig(), created_at: new Date().toISOString(),
    }, ...prev]);
    setTemplateName(""); setSaveOpen(false);
    showToast("Template saved");
  }

  function loadTemplate(t: ReportTemplate) {
    const c = migrateConfig(t.config);
    setReportType(c.reportType);
    setDatePreset(c.datePreset);
    setDateStart(c.dateStart ?? "");
    setDateEnd(c.dateEnd ?? "");
    setJobFilterType(c.jobFilterType);
    setJobFilterValues(c.jobFilterValues);
    if (c.reportType !== "custom") setSelectedCols(c.columns.length > 0 ? c.columns : REPORT_TYPE_CONFIG[c.reportType].columns.map(col => col.key));
    if (c.customSections) setCustomSections(c.customSections);
    if (c.includeWatermark != null) setIncludeWatermark(c.includeWatermark);
    showToast(`Loaded: ${t.name}`);
  }

  async function handleDeleteTemplate(id: string) {
    await deleteReportTemplate(id);
    setTemplates(prev => prev.filter(t => t.id !== id));
  }

  // ── Toggle helpers ────────────────────────────────────────────────────────────
  function toggleCol(key: string) {
    setSelectedCols(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }

  function toggleFilterValue(v: string) {
    setJobFilterValues(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  }

  function toggleCustomSection(type: ReportType) {
    setCustomSections(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  }

  const filteredJobs = jobs.filter(j =>
    !jobSearch || j.name.toLowerCase().includes(jobSearch.toLowerCase())
  );

  // ── Shared classes ────────────────────────────────────────────────────────────
  const sectionCls = "bg-[#141414] border border-[#2a2a2a] rounded-2xl px-4 py-4";
  const labelCls   = "text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3 block";
  const pillBase   = "px-3 py-2 rounded-xl text-xs font-semibold border transition-colors active:scale-95";
  const pillOn     = "bg-orange-500 border-orange-500 text-white";
  const pillOff    = "bg-[#1A1A1A] border-[#2a2a2a] text-gray-300";

  const rowCount    = previewResult?.totalRows ?? null;
  const previewRows = previewResult?.rows ?? null;
  const previewSecs = previewResult?.sections ?? null;
  const hasData     = (previewRows !== null && previewRows.length > 0) || (previewSecs !== null && previewSecs.length > 0);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0F0F0F] pb-32">

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl border ${
          toastOk ? "bg-[#1A1A1A] border-[#2a2a2a]" : "bg-red-900/80 border-red-700"
        }`}>
          {toast}
        </div>
      )}

      {/* ── Sticky header with always-visible export buttons ─────────────────── */}
      <div className="sticky top-0 z-40 bg-[#0F0F0F]/95 backdrop-blur-md border-b border-[#1a1a1a] px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div>
            <h1 className="text-white font-black text-xl leading-tight">Reports</h1>
            <p className="text-gray-500 text-xs mt-0.5">
              {previewLoading
                ? "Loading preview…"
                : rowCount != null
                  ? `${rowCount} row${rowCount !== 1 ? "s" : ""} · ${REPORT_TYPE_CONFIG[reportType].label}`
                  : "Build and export business reports"
              }
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => runExport("csv")}
              disabled={exporting || previewLoading}
              className="bg-[#1A1A1A] border border-[#2a2a2a] text-white font-bold text-xs px-4 py-2.5 rounded-xl active:scale-95 transition-transform disabled:opacity-40 flex items-center gap-1.5"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              CSV
            </button>
            <button
              onClick={() => runExport("pdf")}
              disabled={exporting || previewLoading}
              className="bg-orange-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl active:scale-95 transition-transform disabled:opacity-40 flex items-center gap-1.5"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
              PDF
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 flex flex-col gap-4 max-w-2xl mx-auto">

        {/* ── Saved templates ──────────────────────────────────────────────────── */}
        {templates.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className={`${labelCls} mb-0`}>Saved Templates</span>
            </div>
            <div className="flex flex-col gap-2">
              {templates.map(t => {
                const rt  = (LEGACY_TYPE_MAP[t.config.reportType as string] ?? t.config.reportType) as ReportType;
                const cfg = REPORT_TYPE_CONFIG[rt] ?? REPORT_TYPE_CONFIG["job_profitability"];
                return (
                  <div key={t.id} className="bg-[#141414] border border-[#2a2a2a] rounded-2xl px-4 py-4 flex items-center gap-3">
                    <span className="text-2xl shrink-0">{cfg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm truncate">{t.name}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{cfg.label} · {DATE_PRESET_LABELS[t.config.datePreset] ?? t.config.datePreset}</p>
                    </div>
                    <button
                      onClick={() => loadTemplate(t)}
                      className="bg-orange-500 text-white font-bold text-xs px-3 py-2 rounded-xl active:scale-95 transition-transform shrink-0"
                    >
                      Load →
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(t.id)}
                      className="text-gray-600 text-sm hover:text-red-400 active:scale-95 transition-transform shrink-0 w-8 h-8 flex items-center justify-center"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Report type grid ─────────────────────────────────────────────────── */}
        <div className={sectionCls}>
          <span className={labelCls}>Report Type</span>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(REPORT_TYPE_CONFIG) as [ReportType, typeof REPORT_TYPE_CONFIG[ReportType]][]).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setReportType(key)}
                className={`flex flex-col gap-1.5 px-3 py-3.5 rounded-xl border text-left transition-all active:scale-95 ${
                  reportType === key
                    ? "bg-orange-500/10 border-orange-500"
                    : "bg-[#1A1A1A] border-[#2a2a2a]"
                }`}
              >
                <span className="text-xl leading-none">{cfg.icon}</span>
                <p className={`font-bold text-xs leading-tight ${reportType === key ? "text-orange-400" : "text-white"}`}>
                  {cfg.label}
                </p>
                <p className="text-gray-500 text-[10px] leading-tight">{cfg.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* ── Date range ───────────────────────────────────────────────────────── */}
        <div className={sectionCls}>
          <span className={labelCls}>Date Range</span>
          <div className="flex flex-wrap gap-2 mb-3">
            {(Object.entries(DATE_PRESET_LABELS) as [DatePreset, string][]).map(([key, lbl]) => (
              <button
                key={key}
                onClick={() => setDatePreset(key)}
                className={`${pillBase} ${datePreset === key ? pillOn : pillOff}`}
              >
                {lbl}
              </button>
            ))}
          </div>
          {datePreset === "custom" && (
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <label className="text-gray-500 text-xs mb-1 block">Start</label>
                <input
                  type="date"
                  value={dateStart}
                  onChange={e => setDateStart(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-[#333] text-white rounded-xl px-3 py-3 text-base focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="text-gray-500 text-xs mb-1 block">End</label>
                <input
                  type="date"
                  value={dateEnd}
                  onChange={e => setDateEnd(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-[#333] text-white rounded-xl px-3 py-3 text-base focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Job filter ───────────────────────────────────────────────────────── */}
        <div className={sectionCls}>
          <span className={labelCls}>Job Filter</span>
          <div className="flex flex-wrap gap-2 mb-3">
            {(["all", "type", "status", "specific"] as JobFilterType[]).map(opt => (
              <button
                key={opt}
                onClick={() => setJobFilterType(opt)}
                className={`${pillBase} ${jobFilterType === opt ? pillOn : pillOff}`}
              >
                {opt === "all" ? "All Jobs" : opt === "type" ? "By Type" : opt === "status" ? "By Status" : "Specific Jobs"}
              </button>
            ))}
          </div>

          {jobFilterType === "type" && (
            <div className="flex flex-wrap gap-2">
              {JOB_TYPES.map(t => (
                <button key={t} onClick={() => toggleFilterValue(t)}
                  className={`${pillBase} py-1.5 ${jobFilterValues.includes(t) ? pillOn : pillOff}`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          {jobFilterType === "status" && (
            <div className="flex gap-2 flex-wrap">
              {["active", "completed", "on_hold"].map(s => (
                <button key={s} onClick={() => toggleFilterValue(s)}
                  className={`${pillBase} ${jobFilterValues.includes(s) ? pillOn : pillOff}`}
                >
                  {s === "on_hold" ? "On Hold" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          )}

          {jobFilterType === "specific" && (
            <div>
              <input
                type="text"
                value={jobSearch}
                onChange={e => setJobSearch(e.target.value)}
                placeholder="Search jobs…"
                className="w-full bg-[#1A1A1A] border border-[#333] text-white rounded-xl px-3 py-3 text-base mb-2 focus:outline-none focus:border-orange-500"
              />
              <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                {filteredJobs.map(j => (
                  <button key={j.id} onClick={() => toggleFilterValue(j.id)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                      jobFilterValues.includes(j.id)
                        ? "bg-orange-500/10 border border-orange-500/30"
                        : "bg-[#1A1A1A] border border-[#2a2a2a]"
                    }`}
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      jobFilterValues.includes(j.id) ? "bg-orange-500 border-orange-500" : "border-[#444]"
                    }`}>
                      {jobFilterValues.includes(j.id) && (
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">{j.name}</p>
                      {j.job_number && <p className="text-gray-500 text-xs">{j.job_number}</p>}
                    </div>
                  </button>
                ))}
                {filteredJobs.length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-3">No jobs found</p>
                )}
              </div>
              {jobFilterValues.length > 0 && (
                <p className="text-orange-400 text-xs mt-2">{jobFilterValues.length} job{jobFilterValues.length !== 1 ? "s" : ""} selected</p>
              )}
            </div>
          )}
        </div>

        {/* ── Columns (or custom sections) ─────────────────────────────────────── */}
        {reportType === "custom" ? (
          <div className={sectionCls}>
            <span className={labelCls}>Sections to Include</span>
            <div className="flex flex-col gap-2">
              {CUSTOM_SECTION_OPTIONS.map(opt => (
                <button
                  key={opt.type}
                  onClick={() => toggleCustomSection(opt.type)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl border text-left transition-colors active:scale-95 ${
                    customSections.includes(opt.type)
                      ? "bg-orange-500/10 border-orange-500/30"
                      : "bg-[#1A1A1A] border-[#2a2a2a]"
                  }`}
                >
                  <span className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                    customSections.includes(opt.type) ? "bg-orange-500 border-orange-500" : "border-[#444]"
                  }`}>
                    {customSections.includes(opt.type) && (
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                  <span className="flex-1">
                    <p className={`font-semibold text-sm ${customSections.includes(opt.type) ? "text-white" : "text-gray-300"}`}>
                      {REPORT_TYPE_CONFIG[opt.type].icon} {opt.label}
                    </p>
                    <p className="text-gray-500 text-xs">{REPORT_TYPE_CONFIG[opt.type].description}</p>
                  </span>
                </button>
              ))}
            </div>
            {customSections.length === 0 && (
              <p className="text-yellow-500 text-xs mt-2">Select at least one section</p>
            )}
          </div>
        ) : reportType === "tax_summary" ? (
          <div className={sectionCls}>
            <span className={labelCls}>Columns</span>
            <p className="text-gray-500 text-sm">Tax Summary Report shows all Schedule C line items. No column selection needed — all fields are included automatically.</p>
          </div>
        ) : (
          <div className={sectionCls}>
            <div className="flex items-center justify-between mb-3">
              <span className={`${labelCls} mb-0`}>Columns</span>
              <div className="flex gap-3">
                <button onClick={() => setSelectedCols(allCols.map(c => c.key))} className="text-orange-400 text-xs font-semibold">All</button>
                <button onClick={() => setSelectedCols([])} className="text-gray-500 text-xs font-semibold">None</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {allCols.map(col => (
                <button
                  key={col.key}
                  onClick={() => toggleCol(col.key)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left border transition-colors active:scale-95 ${
                    selectedCols.includes(col.key)
                      ? "bg-orange-500/10 border-orange-500/30"
                      : "bg-[#1A1A1A] border-[#2a2a2a]"
                  }`}
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    selectedCols.includes(col.key) ? "bg-orange-500 border-orange-500" : "border-[#444]"
                  }`}>
                    {selectedCols.includes(col.key) && (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                  <span className={`text-xs font-medium ${selectedCols.includes(col.key) ? "text-white" : "text-gray-400"}`}>
                    {col.label}
                  </span>
                </button>
              ))}
            </div>
            {selectedCols.length === 0 && (
              <p className="text-yellow-500 text-xs mt-2">Select at least one column</p>
            )}
          </div>
        )}

        {/* ── Options ──────────────────────────────────────────────────────────── */}
        <div className={sectionCls}>
          <span className={labelCls}>Options</span>
          <button
            onClick={() => setIncludeWatermark(p => !p)}
            className={`flex items-center gap-3 px-3 py-3 rounded-xl border text-left transition-colors w-full active:scale-95 ${
              includeWatermark
                ? "bg-orange-500/10 border-orange-500/30"
                : "bg-[#1A1A1A] border-[#2a2a2a]"
            }`}
          >
            <span className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
              includeWatermark ? "bg-orange-500 border-orange-500" : "border-[#444]"
            }`}>
              {includeWatermark && (
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </span>
            <div>
              <p className="text-white text-sm font-semibold">Confidential Watermark</p>
              <p className="text-gray-500 text-xs">Add diagonal &quot;CONFIDENTIAL&quot; text to PDF pages</p>
            </div>
          </button>
        </div>

        {/* ── Save template ─────────────────────────────────────────────────────── */}
        <button
          onClick={() => { setSaveOpen(true); setTemplateName(""); }}
          className="w-full bg-[#141414] border border-[#2a2a2a] text-gray-300 font-semibold py-3.5 rounded-2xl active:scale-95 transition-transform text-sm"
        >
          Save as Template
        </button>

        {/* ── Live preview ─────────────────────────────────────────────────────── */}
        <div className={sectionCls}>
          <div className="flex items-center justify-between mb-3">
            <span className={`${labelCls} mb-0`}>
              Preview
              {rowCount != null && !previewLoading && (
                <span className="ml-2 text-gray-600 normal-case tracking-normal font-normal">
                  — {rowCount > 10 ? `first 10 of ${rowCount}` : rowCount} row{rowCount !== 1 ? "s" : ""}
                </span>
              )}
            </span>
            {previewLoading && (
              <svg className="animate-spin text-orange-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
              </svg>
            )}
          </div>

          {/* Loading skeleton */}
          {previewLoading && !hasData && (
            <div className="flex flex-col gap-2">
              {[1,2,3].map(i => (
                <div key={i} className="h-8 bg-[#1A1A1A] rounded-xl animate-pulse" />
              ))}
            </div>
          )}

          {/* No data */}
          {!previewLoading && previewResult !== null && !hasData && (
            <p className="text-gray-500 text-sm text-center py-6">No data found for this period and filter.</p>
          )}

          {/* Initial state (before first fetch completes) */}
          {!previewLoading && previewResult === null && (
            <p className="text-gray-600 text-sm text-center py-6">Configuring report…</p>
          )}

          {/* Single report preview */}
          {previewRows !== null && previewRows.length > 0 && (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-xs min-w-max">
                <thead>
                  <tr className="border-b border-[#2a2a2a]">
                    {activeCols.map(c => (
                      <th key={c.key} className="text-left text-gray-500 font-semibold pb-2 pr-4 whitespace-nowrap">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.slice(0, 10).map((row, i) => (
                    <tr key={i} className={i % 2 === 1 ? "bg-[#1A1A1A]" : ""}>
                      {activeCols.map(c => {
                        const v = row[c.key];
                        const s = v != null ? String(v) : "—";
                        const isNeg = s.startsWith("(") && s.endsWith(")");
                        return (
                          <td key={c.key} className={`py-2 pr-4 whitespace-nowrap max-w-[180px] truncate ${isNeg ? "text-red-400" : "text-gray-300"}`}>
                            {s}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Multi-section preview (custom report) */}
          {previewSecs !== null && previewSecs.map((sec, si) => {
            const secCols = REPORT_TYPE_CONFIG[sec.type]?.columns ?? [];
            return (
              <div key={si} className={si > 0 ? "mt-5 pt-4 border-t border-[#2a2a2a]" : ""}>
                <p className="text-orange-400 text-xs font-bold mb-2">{sec.title} <span className="text-gray-600 font-normal">({sec.rows.length} rows)</span></p>
                {sec.rows.length === 0 ? (
                  <p className="text-gray-600 text-xs">No data for this period.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs min-w-max">
                      <thead>
                        <tr className="border-b border-[#2a2a2a]">
                          {secCols.map(c => (
                            <th key={c.key} className="text-left text-gray-500 font-semibold pb-1.5 pr-3 whitespace-nowrap">{c.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sec.rows.slice(0, 10).map((row, i) => (
                          <tr key={i} className={i % 2 === 1 ? "bg-[#1A1A1A]" : ""}>
                            {secCols.map(c => {
                              const v = row[c.key];
                              const s = v != null ? String(v) : "—";
                              const isNeg = s.startsWith("(") && s.endsWith(")");
                              return (
                                <td key={c.key} className={`py-1.5 pr-3 whitespace-nowrap max-w-[160px] truncate ${isNeg ? "text-red-400" : "text-gray-300"}`}>
                                  {s}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Bottom export buttons ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 pb-4">
          <button
            onClick={() => runExport("csv")}
            disabled={exporting}
            className="bg-[#1A1A1A] border border-[#2a2a2a] text-white font-bold py-4 rounded-2xl active:scale-95 transition-transform disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export CSV
          </button>
          <button
            onClick={() => runExport("pdf")}
            disabled={exporting}
            className="bg-orange-500 text-white font-bold py-4 rounded-2xl active:scale-95 transition-transform hover:bg-orange-400 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            Export PDF
          </button>
        </div>

      </div>

      {/* ── Save template modal ───────────────────────────────────────────────── */}
      {saveOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#141414] border border-[#2a2a2a] rounded-2xl p-5">
            <h3 className="text-white font-black text-lg mb-1">Save as Template</h3>
            <p className="text-gray-500 text-sm mb-4">Name this configuration so you can run it again in one tap.</p>
            <input
              type="text"
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSave()}
              placeholder="e.g. Monthly Materials Summary"
              autoFocus
              className="w-full bg-[#1A1A1A] border border-[#333] text-white rounded-xl px-4 py-3.5 text-base focus:outline-none focus:border-orange-500 mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setSaveOpen(false)}
                className="flex-1 bg-[#1A1A1A] border border-[#2a2a2a] text-gray-300 font-bold text-sm py-3.5 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!templateName.trim() || saving}
                className="flex-1 bg-orange-500 text-white font-bold text-sm py-3.5 rounded-xl hover:bg-orange-400 disabled:opacity-40"
              >
                {saving ? "Saving…" : "Save Template"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
