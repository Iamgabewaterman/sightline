"use client";

import { useState, useRef } from "react";
import {
  ParsedMaterialRow,
  ParsedLaborRow,
  MaterialPreviewRow,
  LaborPreviewRow,
  JobImportResult,
  previewMaterialsImport,
  previewLaborImport,
  confirmMaterialsImport,
  confirmLaborImport,
} from "@/app/actions/job-import";

// ── CSV Parser (same robust parser as the main import tool) ──────────────────

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"' && clean[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field); field = "";
    } else if (ch === "\n") {
      row.push(field); field = "";
      if (row.some((f) => f !== "")) records.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((f) => f !== "")) records.push(row);

  if (records.length === 0) return { headers: [], rows: [] };
  const headers = records[0].map((h) => h.trim());
  const rows = records.slice(1).map((r) =>
    Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()]))
  );
  return { headers, rows };
}

function parseAmount(raw: string): number | null {
  if (!raw) return null;
  const n = parseFloat(raw.replace(/[$,\s]/g, ""));
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

function parseDate(raw: string): string {
  if (!raw) return new Date().toISOString().slice(0, 10);
  // Handle MM/DD/YYYY, YYYY-MM-DD, M/D/YYYY
  const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  // Try native parse
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

// ── QB format auto-detection ──────────────────────────────────────────────────
// Returns "labor" if it looks like a QB Time Activity export, else "materials"

function detectFormat(headers: string[]): "labor" | "materials" {
  const lower = headers.map((h) => h.toLowerCase());
  const laborIndicators = ["hours", "duration", "time", "employee", "worker", "crew"];
  return laborIndicators.some((k) => lower.some((h) => h.includes(k)))
    ? "labor"
    : "materials";
}

// ── Column mapping helpers ────────────────────────────────────────────────────

const MATERIAL_NAME_COLS = ["description", "name", "item", "item name", "product", "memo", "vendor", "payee", "source name"];
const MATERIAL_QTY_COLS  = ["qty", "quantity", "qty ordered", "amount", "count", "units"];
const MATERIAL_COST_COLS = ["unit cost", "unit price", "price", "rate", "cost", "unit amount", "amount"];
const MATERIAL_DATE_COLS = ["date", "transaction date", "invoice date"];

const LABOR_NAME_COLS  = ["employee", "name", "crew", "worker", "employee name", "crew member", "source name"];
const LABOR_HOURS_COLS = ["hours", "duration", "duration (decimal)", "time (hours)", "qty", "quantity"];
const LABOR_RATE_COLS  = ["rate", "billing rate", "hourly rate", "wage", "pay rate"];
const LABOR_DATE_COLS  = ["date", "work date", "activity date", "transaction date"];

function findCol(headers: string[], candidates: string[]): string | null {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const c of candidates) {
    const idx = lower.indexOf(c);
    if (idx !== -1) return headers[idx];
  }
  // partial match fallback
  for (const c of candidates) {
    const idx = lower.findIndex((h) => h.includes(c));
    if (idx !== -1) return headers[idx];
  }
  return null;
}

// ── Parse QB rows → typed rows ────────────────────────────────────────────────

function parseMaterialRows(
  csvRows: Record<string, string>[],
  headers: string[]
): { rows: ParsedMaterialRow[]; skipped: number } {
  const nameCol  = findCol(headers, MATERIAL_NAME_COLS);
  const qtyCol   = findCol(headers, MATERIAL_QTY_COLS);
  const costCol  = findCol(headers, MATERIAL_COST_COLS);

  // If qtyCol and costCol point to the same column (e.g. "Amount"), prefer cost
  const effectiveQtyCol = qtyCol === costCol ? null : qtyCol;

  const rows: ParsedMaterialRow[] = [];
  let skipped = 0;

  for (const r of csvRows) {
    const name = nameCol ? r[nameCol]?.trim() : "";
    if (!name) { skipped++; continue; }

    const qtyRaw  = effectiveQtyCol ? r[effectiveQtyCol] : "1";
    const costRaw = costCol ? r[costCol] : "";

    const qty_ordered = parseFloat(qtyRaw?.replace(/[,$]/g, "") ?? "1") || 1;
    const unit_cost   = parseAmount(costRaw ?? "");

    rows.push({ name, qty_ordered, unit_cost, unit: "ea" });
  }

  return { rows, skipped };
}

function parseLaborRows(
  csvRows: Record<string, string>[],
  headers: string[]
): { rows: ParsedLaborRow[]; skipped: number } {
  const nameCol  = findCol(headers, LABOR_NAME_COLS);
  const hoursCol = findCol(headers, LABOR_HOURS_COLS);
  const rateCol  = findCol(headers, LABOR_RATE_COLS);
  const dateCol  = findCol(headers, LABOR_DATE_COLS);

  const rows: ParsedLaborRow[] = [];
  let skipped = 0;

  for (const r of csvRows) {
    const crew_name = nameCol ? r[nameCol]?.trim() : "";
    if (!crew_name) { skipped++; continue; }

    const hoursRaw = hoursCol ? r[hoursCol] : "";
    const rateRaw  = rateCol ? r[rateCol] : "0";
    const dateRaw  = dateCol ? r[dateCol] : "";

    const hours = parseFloat(hoursRaw?.replace(/[,$]/g, "") ?? "0") || 0;
    if (hours <= 0) { skipped++; continue; }
    const rate = parseAmount(rateRaw ?? "") ?? 0;
    const date = parseDate(dateRaw ?? "");

    rows.push({ crew_name, hours, rate, date });
  }

  return { rows, skipped };
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: "new" | "update" | "duplicate" }) {
  if (status === "new") {
    return (
      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 shrink-0">
        NEW
      </span>
    );
  }
  if (status === "update") {
    return (
      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 shrink-0">
        UPDATE
      </span>
    );
  }
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#333] text-gray-500 shrink-0">
      SKIP
    </span>
  );
}

function rowBg(status: "new" | "update" | "duplicate") {
  if (status === "new") return "bg-green-500/5 border-b border-green-500/10";
  if (status === "update") return "bg-yellow-500/5 border-b border-yellow-500/10";
  return "bg-[#111] border-b border-[#1e1e1e] opacity-50";
}

// ── Main component ────────────────────────────────────────────────────────────

export type ImportMode = "materials" | "labor";

export default function JobImportModal({
  jobId,
  mode,
  onClose,
  onComplete,
}: {
  jobId: string;
  mode: ImportMode;
  onClose: () => void;
  onComplete: () => void;
}) {
  type Step = "upload" | "preview" | "done";
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [detectedFormat, setDetectedFormat] = useState<"labor" | "materials">("materials");
  const [skippedBlank, setSkippedBlank] = useState(0);

  const [materialPreview, setMaterialPreview] = useState<MaterialPreviewRow[]>([]);
  const [laborPreview, setLaborPreview] = useState<LaborPreviewRow[]>([]);

  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<JobImportResult | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError("");

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      const { headers, rows } = parseCSV(text);

      if (rows.length === 0) {
        setParseError("No data rows found in this CSV.");
        return;
      }

      const fmt = detectFormat(headers);
      setDetectedFormat(fmt);

      if (mode === "labor" || fmt === "labor") {
        const { rows: parsed, skipped } = parseLaborRows(rows, headers);
        setSkippedBlank(skipped);
        if (parsed.length === 0) {
          setParseError("Could not find crew name or hours columns. Check the column mapping below.");
          return;
        }
        const preview = await previewLaborImport(jobId, parsed);
        setLaborPreview(preview);
        setStep("preview");
      } else {
        const { rows: parsed, skipped } = parseMaterialRows(rows, headers);
        setSkippedBlank(skipped);
        if (parsed.length === 0) {
          setParseError("Could not find a name/description column. Check that your CSV has item names.");
          return;
        }
        const preview = await previewMaterialsImport(jobId, parsed);
        setMaterialPreview(preview);
        setStep("preview");
      }
    };
    reader.readAsText(file);
  }

  async function handleConfirm() {
    setConfirming(true);
    let res: JobImportResult;
    if (mode === "labor" || detectedFormat === "labor") {
      res = await confirmLaborImport(jobId, laborPreview.filter((r) => r.status !== "duplicate"));
    } else {
      res = await confirmMaterialsImport(jobId, materialPreview.filter((r) => r.status !== "duplicate"));
    }
    setResult(res);
    setStep("done");
    setConfirming(false);
  }

  const isLabor = mode === "labor" || detectedFormat === "labor";
  const preview = isLabor ? laborPreview : materialPreview;
  const newCount  = preview.filter((r) => r.status === "new").length;
  const updateCount = preview.filter((r) => r.status === "update").length;
  const dupCount  = preview.filter((r) => r.status === "duplicate").length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative w-full sm:max-w-lg bg-[#111] border border-[#2a2a2a] rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#1e1e1e] shrink-0">
          <div>
            <h2 className="text-white font-bold text-lg">
              Import {mode === "labor" ? "Labor" : "Materials"}
            </h2>
            <p className="text-gray-500 text-xs mt-0.5">QuickBooks CSV · smart deduplication</p>
          </div>
          <button onClick={onClose} className="text-gray-500 p-2 active:opacity-60">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* ── STEP: upload ── */}
        {step === "upload" && (
          <div className="p-5 flex flex-col gap-4">
            <div
              className="border-2 border-dashed border-[#2a2a2a] rounded-xl p-8 text-center cursor-pointer active:border-orange-500/50 hover:border-orange-500/30 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" className="mx-auto mb-3">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <p className="text-white font-semibold mb-1">Upload CSV</p>
              <p className="text-gray-500 text-sm">
                {mode === "labor"
                  ? "QuickBooks Time Activity export"
                  : "QuickBooks Expense or Purchase export"}
              </p>
            </div>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />

            {parseError && (
              <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-xl px-4 py-3">
                {parseError}
              </p>
            )}

            <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-3">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                Expected QB columns
              </p>
              {mode === "labor" ? (
                <p className="text-gray-500 text-xs">Employee · Date · Hours/Duration · Billing Rate</p>
              ) : (
                <p className="text-gray-500 text-xs">Description/Vendor · Date · Qty · Unit Cost/Amount</p>
              )}
            </div>
          </div>
        )}

        {/* ── STEP: preview ── */}
        {step === "preview" && (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 px-5 pt-4 pb-3 shrink-0">
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-3 text-center">
                <p className="text-green-400 font-black text-xl leading-none mb-0.5">{newCount}</p>
                <p className="text-green-500 text-xs">New</p>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-3 text-center">
                <p className="text-yellow-400 font-black text-xl leading-none mb-0.5">{updateCount}</p>
                <p className="text-yellow-500 text-xs">Update</p>
              </div>
              <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-3 py-3 text-center">
                <p className="text-gray-500 font-black text-xl leading-none mb-0.5">{dupCount}</p>
                <p className="text-gray-500 text-xs">Skip</p>
              </div>
            </div>

            {skippedBlank > 0 && (
              <p className="text-gray-600 text-xs px-5 mb-1">
                {skippedBlank} blank / invalid rows ignored
              </p>
            )}

            {/* Row list */}
            <div className="overflow-y-auto flex-1 px-5 pb-2">
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider py-2">
                Preview — {preview.length} rows from <span className="text-orange-400">{fileName}</span>
              </p>
              <div className="rounded-xl border border-[#2a2a2a] overflow-hidden">
                {isLabor
                  ? (laborPreview as LaborPreviewRow[]).map((row, i) => (
                      <div key={i} className={`flex items-center gap-3 px-4 py-3 ${rowBg(row.status)}`}>
                        <StatusBadge status={row.status} />
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-sm truncate ${row.status === "duplicate" ? "text-gray-500" : "text-white"}`}>
                            {row.parsed.crew_name}
                          </p>
                          <p className="text-gray-500 text-xs">
                            {row.parsed.date} · {row.parsed.hours}h
                            {row.parsed.rate > 0 && ` @ $${row.parsed.rate}/hr`}
                          </p>
                        </div>
                        <p className={`text-sm font-semibold tabular-nums ${row.status === "duplicate" ? "text-gray-600" : "text-white"}`}>
                          ${Math.round(row.parsed.hours * row.parsed.rate).toLocaleString()}
                        </p>
                      </div>
                    ))
                  : (materialPreview as MaterialPreviewRow[]).map((row, i) => (
                      <div key={i} className={`flex items-center gap-3 px-4 py-3 ${rowBg(row.status)}`}>
                        <StatusBadge status={row.status} />
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-sm truncate ${row.status === "duplicate" ? "text-gray-500" : "text-white"}`}>
                            {row.parsed.name}
                          </p>
                          <p className="text-gray-500 text-xs">
                            qty {row.parsed.qty_ordered}
                            {row.parsed.unit_cost !== null && ` · $${row.parsed.unit_cost}/ea`}
                          </p>
                        </div>
                        {row.parsed.unit_cost !== null && (
                          <p className={`text-sm font-semibold tabular-nums ${row.status === "duplicate" ? "text-gray-600" : "text-white"}`}>
                            ${(row.parsed.qty_ordered * row.parsed.unit_cost).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </p>
                        )}
                      </div>
                    ))
                }
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 px-5 pb-5 pt-3 shrink-0 border-t border-[#1e1e1e]">
              <button
                onClick={() => { setStep("upload"); if (fileRef.current) fileRef.current.value = ""; }}
                className="flex-1 bg-[#1A1A1A] border border-[#2a2a2a] text-gray-300 font-semibold py-4 rounded-xl active:scale-95 transition-transform"
              >
                ← Back
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirming || (newCount + updateCount === 0)}
                className="flex-2 flex-1 bg-orange-500 text-white font-bold py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
              >
                {confirming
                  ? "Importing…"
                  : newCount + updateCount === 0
                  ? "Nothing to import"
                  : `Confirm Import (${newCount + updateCount})`}
              </button>
            </div>
          </>
        )}

        {/* ── STEP: done ── */}
        {step === "done" && result && (
          <div className="p-5 flex flex-col gap-4">
            <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mt-2">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h3 className="text-white font-black text-xl text-center">Import Complete</h3>

            <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl overflow-hidden">
              {[
                { label: "Inserted", value: result.inserted, color: "text-green-400" },
                { label: "Updated", value: result.updated, color: "text-yellow-400" },
                { label: "Skipped", value: result.skipped, color: "text-gray-500" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between items-center px-5 py-3.5 border-b border-[#1e1e1e] last:border-0">
                  <span className="text-gray-300 text-sm">{label}</span>
                  <span className={`font-black text-xl ${color}`}>{value}</span>
                </div>
              ))}
            </div>

            {result.errors.length > 0 && (
              <div className="bg-red-500/10 border border-red-800 rounded-xl px-4 py-3 max-h-32 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-red-300 text-xs">{e}</p>
                ))}
              </div>
            )}

            <button
              onClick={() => { onComplete(); onClose(); }}
              className="w-full bg-orange-500 text-white font-bold py-4 rounded-xl active:scale-95 transition-transform"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
