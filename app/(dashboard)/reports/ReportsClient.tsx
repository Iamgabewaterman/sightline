"use client";

import { useState, useEffect, useCallback } from "react";
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
  ExportFormat,
  ReportConfig,
  ReportTemplate,
  ColumnDef,
  ReportSection,
} from "./types";
import {
  REPORT_TYPE_CONFIG,
  DATE_PRESET_LABELS,
  JOB_TYPES,
  resolveDateRange,
} from "./types";
import type { BusinessProfile } from "@/types";

// ── Props ────────────────────────────────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildCsvContent(cols: ColumnDef[], rows: Record<string, unknown>[]): string {
  const header = cols.map(c => `"${c.label}"`).join(",");
  const body   = rows.map(row =>
    cols.map(c => {
      const v = row[c.key];
      if (v == null) return '""';
      return `"${String(v).replace(/"/g, '""')}"`;
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

function dateRangeLabel(preset: DatePreset, start?: string, end?: string, resolved?: { start: string; end: string }): string {
  if (preset === "custom") return `${start ?? "?"} – ${end ?? "?"}`;
  if (resolved) return `${resolved.start} – ${resolved.end}`;
  return DATE_PRESET_LABELS[preset];
}

// ── Main component ───────────────────────────────────────────────────────────

export default function ReportsClient({ jobs, savedTemplates: initialTemplates, businessProfile }: Props) {
  // ── Config state ────────────────────────────────────────────────────────────
  const [reportType,       setReportType]       = useState<ReportType>("job_summary");
  const [datePreset,       setDatePreset]        = useState<DatePreset>("this_month");
  const [dateStart,        setDateStart]         = useState("");
  const [dateEnd,          setDateEnd]           = useState("");
  const [jobFilterType,    setJobFilterType]     = useState<JobFilterType>("all");
  const [jobFilterValues,  setJobFilterValues]   = useState<string[]>([]);
  const [selectedCols,     setSelectedCols]      = useState<string[]>([]);
  const [exportFormat,     setExportFormat]      = useState<ExportFormat>("csv");

  // ── UI state ────────────────────────────────────────────────────────────────
  const [templates,        setTemplates]         = useState<ReportTemplate[]>(initialTemplates);
  const [previewRows,      setPreviewRows]       = useState<Record<string, unknown>[] | null>(null);
  const [previewSections,  setPreviewSections]   = useState<ReportSection[] | null>(null);
  const [previewLoading,   setPreviewLoading]    = useState(false);
  const [downloading,      setDownloading]       = useState(false);
  const [saveOpen,         setSaveOpen]          = useState(false);
  const [templateName,     setTemplateName]      = useState("");
  const [saving,           setSaving]            = useState(false);
  const [jobSearch,        setJobSearch]         = useState("");
  const [toast,            setToast]             = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  // Reset columns when report type changes
  useEffect(() => {
    if (reportType === "full_business") { setSelectedCols([]); return; }
    setSelectedCols(REPORT_TYPE_CONFIG[reportType].columns.map(c => c.key));
  }, [reportType]);

  // Reset job filter values when filter type changes
  useEffect(() => { setJobFilterValues([]); }, [jobFilterType]);

  // Reset preview when config changes
  useEffect(() => { setPreviewRows(null); setPreviewSections(null); }, [reportType, datePreset, dateStart, dateEnd, jobFilterType, jobFilterValues.join(","), selectedCols.join(",")]);

  const buildConfig = useCallback((): ReportConfig => ({
    reportType,
    datePreset,
    dateStart: datePreset === "custom" ? dateStart : undefined,
    dateEnd:   datePreset === "custom" ? dateEnd   : undefined,
    jobFilterType,
    jobFilterValues,
    columns: selectedCols,
    exportFormat,
  }), [reportType, datePreset, dateStart, dateEnd, jobFilterType, jobFilterValues, selectedCols, exportFormat]);

  // ── Active column defs for selected type ────────────────────────────────────
  const allCols = reportType === "full_business" ? [] : REPORT_TYPE_CONFIG[reportType].columns;
  const activeCols = allCols.filter(c => selectedCols.includes(c.key));

  // ── Preview ─────────────────────────────────────────────────────────────────
  async function handlePreview() {
    setPreviewLoading(true);
    const result = await fetchReportData({ ...buildConfig(), preview: true });
    setPreviewLoading(false);
    if (result.error) { showToast(result.error); return; }
    if (result.sections) { setPreviewSections(result.sections); setPreviewRows(null); }
    else { setPreviewRows(result.rows); setPreviewSections(null); }
  }

  // ── Download ────────────────────────────────────────────────────────────────
  async function handleDownload() {
    setDownloading(true);
    try {
      const result = await fetchReportData({ ...buildConfig(), preview: false });
      if (result.error) { showToast(result.error); return; }

      const resolved = resolveDateRange(datePreset, dateStart, dateEnd);
      const label    = dateRangeLabel(datePreset, dateStart, dateEnd, resolved);
      const today    = new Date().toISOString().split("T")[0];
      const title    = REPORT_TYPE_CONFIG[reportType].label;
      const slug     = title.replace(/\s+/g, "-").toLowerCase();

      // ── CSV
      if (exportFormat === "csv" || exportFormat === "both") {
        if (result.sections) {
          let csv = "";
          result.sections.forEach(sec => {
            const secCols = REPORT_TYPE_CONFIG[sec.type].columns;
            csv += `\n"${sec.title}"\n` + buildCsvContent(secCols, sec.rows) + "\n";
          });
          triggerDownload(csv.trim(), `${slug}-${today}.csv`, "text/csv");
        } else {
          const csv = buildCsvContent(activeCols, result.rows);
          triggerDownload(csv, `${slug}-${today}.csv`, "text/csv");
        }
      }

      // ── PDF
      if (exportFormat === "pdf" || exportFormat === "both") {
        let logoUrl: string | null = null;
        if (businessProfile?.logo_path) {
          const supabase = createClient();
          const { data: signed } = await supabase.storage
            .from("business-logos")
            .createSignedUrl(businessProfile.logo_path, 300);
          logoUrl = signed?.signedUrl ?? null;
        }

        if (result.sections) {
          const sections = result.sections.map(sec => ({
            title:   sec.title,
            columns: REPORT_TYPE_CONFIG[sec.type].columns,
            rows:    sec.rows,
          }));
          await generateAndDownloadReportPDF({
            reportTitle: title, dateRangeLabel: label, generatedDate: today,
            businessProfile, logoUrl, columns: [], rows: [], sections,
          });
        } else {
          await generateAndDownloadReportPDF({
            reportTitle: title, dateRangeLabel: label, generatedDate: today,
            businessProfile, logoUrl, columns: activeCols, rows: result.rows,
          });
        }
      }

      showToast("Download ready");
    } finally {
      setDownloading(false);
    }
  }

  // ── Save template ───────────────────────────────────────────────────────────
  async function handleSave() {
    if (!templateName.trim()) return;
    setSaving(true);
    const result = await saveReportTemplate(templateName.trim(), buildConfig());
    setSaving(false);
    if (result.error) { showToast(result.error); return; }
    setTemplates(prev => [
      { id: result.id!, user_id: "", name: templateName.trim(), config: buildConfig(), created_at: new Date().toISOString() },
      ...prev,
    ]);
    setTemplateName(""); setSaveOpen(false);
    showToast("Template saved");
  }

  // ── Load template ───────────────────────────────────────────────────────────
  function loadTemplate(t: ReportTemplate) {
    const c = t.config;
    setReportType(c.reportType);
    setDatePreset(c.datePreset);
    setDateStart(c.dateStart ?? "");
    setDateEnd(c.dateEnd ?? "");
    setJobFilterType(c.jobFilterType);
    setJobFilterValues(c.jobFilterValues);
    setSelectedCols(c.columns);
    setExportFormat(c.exportFormat);
    showToast(`Loaded: ${t.name}`);
  }

  async function handleDeleteTemplate(id: string) {
    await deleteReportTemplate(id);
    setTemplates(prev => prev.filter(t => t.id !== id));
  }

  // ── Column toggle helpers ────────────────────────────────────────────────────
  function toggleCol(key: string) {
    setSelectedCols(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }

  // ── Job filter value helpers ─────────────────────────────────────────────────
  function toggleFilterValue(v: string) {
    setJobFilterValues(prev =>
      prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]
    );
  }

  const filteredJobs = jobs.filter(j =>
    !jobSearch || j.name.toLowerCase().includes(jobSearch.toLowerCase())
  );

  // ── Shared UI classes ────────────────────────────────────────────────────────
  const sectionCls = "bg-[#141414] border border-[#2a2a2a] rounded-2xl px-4 py-4";
  const labelCls   = "text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3 block";
  const pillBase   = "px-3 py-2 rounded-xl text-xs font-semibold border transition-colors active:scale-95";
  const pillOn     = "bg-orange-500 border-orange-500 text-white";
  const pillOff    = "bg-[#1A1A1A] border-[#2a2a2a] text-gray-300";

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0F0F0F] pb-32">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#1A1A1A] border border-[#2a2a2a] text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0F0F0F]/90 backdrop-blur-md border-b border-[#1a1a1a] px-4 py-3">
        <h1 className="text-white font-black text-xl">Reports</h1>
        <p className="text-gray-500 text-xs mt-0.5">Build and export custom business reports</p>
      </div>

      <div className="px-4 pt-4 flex flex-col gap-4 max-w-2xl mx-auto">

        {/* ── Saved templates ───────────────────────────────────────────────── */}
        {templates.length > 0 && (
          <div>
            <span className={labelCls}>Saved Templates</span>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {templates.map(t => (
                <div
                  key={t.id}
                  className="shrink-0 bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-3 py-2.5 flex items-center gap-2 min-w-[140px]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-bold truncate">{t.name}</p>
                    <p className="text-gray-500 text-xs truncate">{REPORT_TYPE_CONFIG[t.config.reportType].label.replace(" Report", "")}</p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={() => loadTemplate(t)}
                      className="text-orange-400 text-xs font-semibold hover:text-orange-300 active:scale-95 transition-transform"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(t.id)}
                      className="text-gray-600 text-xs hover:text-red-400 active:scale-95 transition-transform"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Report type ───────────────────────────────────────────────────── */}
        <div className={sectionCls}>
          <span className={labelCls}>Report Type</span>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(REPORT_TYPE_CONFIG) as [ReportType, { label: string }][]).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setReportType(key)}
                className={`${pillBase} ${reportType === key ? pillOn : pillOff}`}
              >
                {cfg.label.replace(" Report", "")}
              </button>
            ))}
          </div>
        </div>

        {/* ── Date range ───────────────────────────────────────────────────── */}
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
                  className="w-full bg-[#1A1A1A] border border-[#333] text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="text-gray-500 text-xs mb-1 block">End</label>
                <input
                  type="date"
                  value={dateEnd}
                  onChange={e => setDateEnd(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-[#333] text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Job filter ───────────────────────────────────────────────────── */}
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
                <button
                  key={t}
                  onClick={() => toggleFilterValue(t)}
                  className={`${pillBase} text-xs py-1.5 ${jobFilterValues.includes(t) ? pillOn : pillOff}`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          {jobFilterType === "status" && (
            <div className="flex gap-2">
              {["active", "completed", "on_hold"].map(s => (
                <button
                  key={s}
                  onClick={() => toggleFilterValue(s)}
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
                className="w-full bg-[#1A1A1A] border border-[#333] text-white rounded-xl px-3 py-2.5 text-sm mb-2 focus:outline-none focus:border-orange-500"
              />
              <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                {filteredJobs.map(j => (
                  <button
                    key={j.id}
                    onClick={() => toggleFilterValue(j.id)}
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

        {/* ── Columns ──────────────────────────────────────────────────────── */}
        {reportType === "full_business" ? (
          <div className={sectionCls}>
            <span className={labelCls}>Columns</span>
            <p className="text-gray-500 text-sm">Full Business Report includes all available columns across every section: Job Summary, Materials, Labor, Profitability, Invoices & Payments, and Mileage & Tax.</p>
          </div>
        ) : (
          <div className={sectionCls}>
            <div className="flex items-center justify-between mb-3">
              <span className={`${labelCls} mb-0`}>Columns</span>
              <div className="flex gap-3">
                <button onClick={() => setSelectedCols(allCols.map(c => c.key))} className="text-orange-400 text-xs font-semibold hover:text-orange-300">All</button>
                <button onClick={() => setSelectedCols([])} className="text-gray-500 text-xs font-semibold hover:text-gray-400">None</button>
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

        {/* ── Export format ─────────────────────────────────────────────────── */}
        <div className={sectionCls}>
          <span className={labelCls}>Export Format</span>
          <div className="grid grid-cols-3 gap-2">
            {(["csv", "pdf", "both"] as ExportFormat[]).map(fmt => (
              <button
                key={fmt}
                onClick={() => setExportFormat(fmt)}
                className={`py-3 rounded-xl font-bold text-sm border transition-colors active:scale-95 ${
                  exportFormat === fmt ? pillOn : pillOff
                }`}
              >
                {fmt === "both" ? "Both" : fmt.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex justify-between mt-2 px-1">
            <p className="text-gray-600 text-xs">Spreadsheet</p>
            <p className="text-gray-600 text-xs">Print / Share</p>
            <p className="text-gray-600 text-xs">All formats</p>
          </div>
        </div>

        {/* ── Actions ───────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={handlePreview}
            disabled={previewLoading || (reportType !== "full_business" && selectedCols.length === 0)}
            className="bg-[#1A1A1A] border border-[#2a2a2a] text-white font-bold text-sm py-4 rounded-2xl active:scale-95 transition-transform disabled:opacity-40"
          >
            {previewLoading ? "Loading…" : "Preview"}
          </button>
          <button
            onClick={() => { setSaveOpen(true); setTemplateName(""); }}
            className="bg-[#1A1A1A] border border-[#2a2a2a] text-white font-bold text-sm py-4 rounded-2xl active:scale-95 transition-transform"
          >
            Save
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading || (reportType !== "full_business" && selectedCols.length === 0)}
            className="bg-orange-500 text-white font-bold text-sm py-4 rounded-2xl active:scale-95 transition-transform hover:bg-orange-400 disabled:opacity-40"
          >
            {downloading ? "Building…" : "Download"}
          </button>
        </div>

        {/* ── Preview table ─────────────────────────────────────────────────── */}
        {(previewRows !== null || previewSections !== null) && (
          <div className={sectionCls}>
            <div className="flex items-center justify-between mb-3">
              <span className={`${labelCls} mb-0`}>Preview (first 5 rows)</span>
              <button onClick={() => { setPreviewRows(null); setPreviewSections(null); }} className="text-gray-600 text-xs hover:text-gray-400">Clear</button>
            </div>

            {/* Single report preview */}
            {previewRows !== null && (
              previewRows.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No data found for this period and filter.</p>
              ) : (
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
                      {previewRows.map((row, i) => (
                        <tr key={i} className={i % 2 === 1 ? "bg-[#1A1A1A]" : ""}>
                          {activeCols.map(c => (
                            <td key={c.key} className="text-gray-300 py-2 pr-4 whitespace-nowrap max-w-[180px] truncate">
                              {row[c.key] != null ? String(row[c.key]) : "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* Full business preview — one section per sub-report */}
            {previewSections !== null && previewSections.map(sec => (
              <div key={sec.title} className="mb-5">
                <p className="text-orange-400 text-xs font-bold mb-2">{sec.title}</p>
                {sec.rows.length === 0 ? (
                  <p className="text-gray-600 text-xs">No data for this period.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs min-w-max">
                      <thead>
                        <tr className="border-b border-[#2a2a2a]">
                          {REPORT_TYPE_CONFIG[sec.type].columns.map(c => (
                            <th key={c.key} className="text-left text-gray-500 font-semibold pb-1.5 pr-3 whitespace-nowrap">
                              {c.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sec.rows.map((row, i) => (
                          <tr key={i} className={i % 2 === 1 ? "bg-[#1A1A1A]" : ""}>
                            {REPORT_TYPE_CONFIG[sec.type].columns.map(c => (
                              <td key={c.key} className="text-gray-300 py-1.5 pr-3 whitespace-nowrap max-w-[160px] truncate">
                                {row[c.key] != null ? String(row[c.key]) : "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Save template sheet ───────────────────────────────────────────── */}
        {saveOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#141414] border border-[#2a2a2a] rounded-2xl p-5">
              <h3 className="text-white font-black text-lg mb-1">Save Report Template</h3>
              <p className="text-gray-500 text-sm mb-4">Give this report configuration a name so you can run it again with one tap.</p>
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
    </div>
  );
}
