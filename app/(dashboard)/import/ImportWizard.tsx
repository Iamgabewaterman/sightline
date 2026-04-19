"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  importClients, importJobs, importExpenses, importLabor,
  ClientRow, JobRow, ExpenseRow, LaborRow, ImportResult,
} from "@/app/actions/import";

// ── CSV Parser ────────────────────────────────────────────────────────────────

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

// ── Types ─────────────────────────────────────────────────────────────────────

type ImportType = "clients" | "jobs" | "expenses" | "labor";
type Step = 1 | 2 | 3 | 4 | 5;

interface FieldDef {
  key: string;
  label: string;
  required: boolean;
  hint?: string;
}

const FIELDS: Record<ImportType, FieldDef[]> = {
  clients: [
    { key: "name",    label: "Name",    required: true  },
    { key: "company", label: "Company", required: false },
    { key: "phone",   label: "Phone",   required: false },
    { key: "email",   label: "Email",   required: false },
    { key: "address", label: "Address", required: false },
    { key: "notes",   label: "Notes",   required: false },
  ],
  jobs: [
    { key: "name",        label: "Job Name",    required: true,  hint: "e.g. Kitchen Remodel" },
    { key: "types",       label: "Type(s)",     required: false, hint: "e.g. tile, roofing" },
    { key: "address",     label: "Address",     required: false },
    { key: "status",      label: "Status",      required: false, hint: "active / on_hold / completed" },
    { key: "notes",       label: "Notes",       required: false },
    { key: "client_name", label: "Client Name", required: false, hint: "Must match an imported client" },
  ],
  expenses: [
    { key: "description", label: "Description / Vendor", required: true },
    { key: "amount",      label: "Amount",               required: true, hint: "e.g. 245.67" },
    { key: "date",        label: "Date",                  required: false, hint: "YYYY-MM-DD" },
    { key: "category",    label: "Category",             required: false, hint: "materials / labor / equipment / vehicle / subcontractor / permits / insurance / other" },
    { key: "job_name",    label: "Job Name",             required: false, hint: "Must match an existing job" },
  ],
  labor: [
    { key: "crew_name",   label: "Crew Member Name", required: true },
    { key: "trade",       label: "Trade",            required: false, hint: "e.g. framing, electrical, plumbing" },
    { key: "hourly_rate", label: "Hourly Rate",      required: false, hint: "e.g. 45.00 — uses saved rate if blank" },
    { key: "hours",       label: "Hours Worked",     required: true,  hint: "e.g. 8" },
    { key: "job_name",    label: "Job Name",         required: true,  hint: "Must match an existing job" },
    { key: "date",        label: "Date",             required: false, hint: "YYYY-MM-DD" },
  ],
};

// Auto-map CSV column → Sightline field
const ALIASES: Record<string, string[]> = {
  name:        ["name","customer","customer name","full name","client name","contact name"],
  company:     ["company","company name","business","business name","organization","firm","employer"],
  phone:       ["phone","phone number","mobile","cell","telephone","tel","contact phone"],
  email:       ["email","email address","e-mail","contact email"],
  address:     ["address","billing address","street address","location","job address","job site"],
  notes:       ["notes","memo","description","comments","note","remarks"],
  types:       ["type","types","job type","category","work type"],
  status:      ["status","job status","state","stage"],
  client_name: ["client","client name","customer","customer name","contact"],
  description: ["description","vendor","merchant","payee","expense","item","line item","memo"],
  amount:      ["amount","total","price","cost","sum","charge","balance","invoice total","expense amount"],
  date:        ["date","transaction date","invoice date","expense date","created","created date","posted date","work date"],
  category:    ["category","expense type","expense category","account","account type"],
  job_name:    ["job","job name","project","project name","work order"],
  crew_name:   ["crew_name","crew name","crew member","employee","worker","person","name","full name"],
  trade:       ["trade","trades","specialty","skill"],
  hourly_rate: ["hourly_rate","hourly rate","rate","pay rate","wage","wages","hourly","rate/hr","$/hr"],
  hours:       ["hours","hours_worked","hours worked","time","duration","hrs"],
};

function autoDetect(csvColumns: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const [field, aliases] of Object.entries(ALIASES)) {
    for (const col of csvColumns) {
      if (aliases.includes(col.toLowerCase().trim())) {
        mapping[field] = col;
        break;
      }
    }
  }
  return mapping;
}

// ── Validation ────────────────────────────────────────────────────────────────

interface RowError { row: number; message: string; }

function validateRows(
  importType: ImportType,
  csvRows: Record<string, string>[],
  mapping: Record<string, string>
): { valid: Record<string, string>[]; errors: RowError[] } {
  const valid: Record<string, string>[] = [];
  const errors: RowError[] = [];
  const fields = FIELDS[importType];

  csvRows.forEach((row, i) => {
    const issues: string[] = [];
    const mapped: Record<string, string> = {};

    for (const f of fields) {
      const col = mapping[f.key];
      const val = col ? (row[col] ?? "").trim() : "";
      if (f.required && !val) issues.push(`${f.label} is required`);
      mapped[f.key] = val;
    }

    if (issues.length > 0) {
      errors.push({ row: i + 1, message: issues.join(", ") });
    } else {
      valid.push(mapped);
    }
  });

  return { valid, errors };
}

// ── Step components ───────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<ImportType, { label: string; desc: string; template: string; example: string }> = {
  clients:  { label: "Clients",  desc: "Import your client contact list", template: "/templates/clients-template.csv",  example: "Name, Company, Phone, Email, Address" },
  jobs:     { label: "Jobs",     desc: "Import job history or active jobs", template: "/templates/jobs-template.csv",   example: "Job Name, Type, Address, Status" },
  expenses: { label: "Expenses", desc: "Import receipts and expense transactions", template: "/templates/expenses-template.csv", example: "Description, Amount, Date, Category" },
  labor:    { label: "Labor & Crew", desc: "Import crew hours and employee records", template: "/templates/labor-template.csv", example: "Crew Name, Trade, Rate, Hours, Job" },
};

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-1 mb-8">
      {([1, 2, 3, 4, 5] as Step[]).map((s) => (
        <div key={s} className="flex items-center gap-1">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
            s < current ? "bg-green-500 text-white"
            : s === current ? "bg-orange-500 text-white"
            : "bg-[#242424] text-gray-500"
          }`}>
            {s < current ? "✓" : s}
          </div>
          {s < 5 && <div className={`h-0.5 w-6 ${s < current ? "bg-green-500" : "bg-[#242424]"}`} />}
        </div>
      ))}
      <span className="text-gray-500 text-xs ml-2">
        {["Pick Type","Upload CSV","Map Columns","Review","Import"][current - 1]}
      </span>
    </div>
  );
}

// ── Main Wizard ───────────────────────────────────────────────────────────────

export default function ImportWizard() {
  const [step, setStep] = useState<Step>(1);
  const [importType, setImportType] = useState<ImportType | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [rowErrors, setRowErrors] = useState<RowError[]>([]);
  const [validRows, setValidRows] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const parsed = parseCSV(text);
      setCsvHeaders(parsed.headers);
      setCsvRows(parsed.rows);
      const auto = autoDetect(parsed.headers);
      setMapping(auto);
      setStep(3);
    };
    reader.readAsText(file);
  }

  function handleReview() {
    if (!importType) return;
    const { valid, errors } = validateRows(importType, csvRows, mapping);
    setValidRows(valid);
    setRowErrors(errors);
    setStep(4);
  }

  async function handleImport() {
    if (!importType || validRows.length === 0) return;
    setImporting(true);
    let res: ImportResult;

    if (importType === "clients") {
      res = await importClients(validRows as unknown as ClientRow[]);
    } else if (importType === "jobs") {
      res = await importJobs(validRows as unknown as JobRow[]);
    } else if (importType === "labor") {
      res = await importLabor(validRows as unknown as LaborRow[]);
    } else {
      res = await importExpenses(validRows as unknown as ExpenseRow[]);
    }

    setResult(res);
    setImporting(false);
    setStep(5);
  }

  function reset() {
    setStep(1); setImportType(null); setCsvHeaders([]); setCsvRows([]);
    setFileName(""); setMapping({}); setRowErrors([]); setValidRows([]);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const fields = importType ? FIELDS[importType] : [];

  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-8 pb-24">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/jobs" className="text-gray-400 text-2xl min-w-[48px] min-h-[48px] flex items-center justify-center active:scale-95">←</Link>
          <div>
            <h1 className="text-3xl font-bold text-white">Data Import</h1>
            <p className="text-gray-500 text-sm">Migrate from QuickBooks, Buildertrend, or any spreadsheet</p>
          </div>
        </div>

        <StepIndicator current={step} />

        {/* ── STEP 1: Pick type ── */}
        {step === 1 && (
          <div>
            <p className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-4">What are you importing?</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {(Object.entries(TYPE_CONFIG) as [ImportType, typeof TYPE_CONFIG[ImportType]][]).map(([type, cfg]) => (
                <button key={type} onClick={() => { setImportType(type); setStep(2); }}
                  className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5 text-left active:scale-95 transition-transform hover:border-orange-500/50">
                  <p className="text-white font-bold text-lg mb-1">{cfg.label}</p>
                  <p className="text-gray-500 text-sm mb-3">{cfg.desc}</p>
                  <p className="text-gray-600 text-xs font-mono">{cfg.example}</p>
                </button>
              ))}
            </div>

            <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Download Templates</p>
              <p className="text-gray-500 text-sm mb-4">Use these templates to format your data exactly right — or just map your existing columns in Step 3.</p>
              <div className="flex flex-col sm:flex-row gap-2">
                {(Object.entries(TYPE_CONFIG) as [ImportType, typeof TYPE_CONFIG[ImportType]][]).map(([type, cfg]) => (
                  <a key={type} href={cfg.template} download
                    className="flex items-center gap-2 bg-[#242424] border border-[#333] text-gray-300 font-semibold text-sm px-4 py-3 rounded-xl active:scale-95 transition-transform hover:border-orange-500/40 hover:text-white">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    {cfg.label} Template
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: Upload CSV ── */}
        {step === 2 && importType && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <button onClick={() => setStep(1)} className="text-gray-400 text-sm active:opacity-70">← Back</button>
              <p className="text-white font-semibold">Import {TYPE_CONFIG[importType].label}</p>
            </div>

            <div
              className="border-2 border-dashed border-[#333] rounded-2xl p-10 text-center cursor-pointer hover:border-orange-500/50 transition-colors mb-4"
              onClick={() => fileRef.current?.click()}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" className="mx-auto mb-4">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <p className="text-white font-semibold text-lg mb-1">Upload your CSV file</p>
              <p className="text-gray-500 text-sm">Exported from QuickBooks, Buildertrend, Excel, or Google Sheets</p>
              <p className="text-gray-600 text-xs mt-2">Click to browse · CSV files only</p>
            </div>

            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />

            <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4 mb-4">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Need the template?</p>
              <a href={TYPE_CONFIG[importType].template} download
                className="inline-flex items-center gap-2 text-orange-400 font-semibold text-sm active:opacity-70">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download {TYPE_CONFIG[importType].label} Template CSV
              </a>
            </div>
          </div>
        )}

        {/* ── STEP 3: Map Columns ── */}
        {step === 3 && importType && (
          <div>
            <div className="flex items-center gap-3 mb-2">
              <button onClick={() => setStep(2)} className="text-gray-400 text-sm active:opacity-70">← Back</button>
              <p className="text-white font-semibold">Map your columns</p>
            </div>
            <p className="text-gray-500 text-sm mb-6">
              <span className="text-orange-400 font-semibold">{fileName}</span> · {csvRows.length} rows detected
            </p>

            <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl overflow-hidden mb-6">
              <div className="grid grid-cols-2 gap-0 px-5 py-3 bg-[#141414] border-b border-[#2a2a2a]">
                <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Sightline Field</span>
                <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Your CSV Column</span>
              </div>
              {fields.map((f) => (
                <div key={f.key} className="grid grid-cols-2 gap-4 px-5 py-3.5 border-b border-[#1e1e1e] last:border-0 items-center">
                  <div>
                    <p className="text-white text-sm font-medium">
                      {f.label}
                      {f.required && <span className="text-orange-400 ml-1">*</span>}
                    </p>
                    {f.hint && <p className="text-gray-600 text-xs mt-0.5">{f.hint}</p>}
                  </div>
                  <select
                    value={mapping[f.key] ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                    className="bg-[#242424] border border-[#333] text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 w-full"
                  >
                    <option value="">(skip)</option>
                    {csvHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Preview table */}
            {csvRows.length > 0 && (
              <div className="mb-6">
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Preview (first 3 rows)</p>
                <div className="overflow-x-auto rounded-xl border border-[#2a2a2a]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#141414]">
                        {fields.filter((f) => mapping[f.key]).map((f) => (
                          <th key={f.key} className="px-4 py-2.5 text-left text-gray-400 text-xs font-semibold uppercase tracking-wider whitespace-nowrap border-b border-[#2a2a2a]">
                            {f.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.slice(0, 3).map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-[#1A1A1A]" : "bg-[#161616]"}>
                          {fields.filter((f) => mapping[f.key]).map((f) => (
                            <td key={f.key} className="px-4 py-2.5 text-white max-w-[200px] truncate">
                              {mapping[f.key] ? row[mapping[f.key]] ?? "" : ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <button onClick={handleReview}
              className="w-full bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform">
              Review Import →
            </button>
          </div>
        )}

        {/* ── STEP 4: Review ── */}
        {step === 4 && importType && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <button onClick={() => setStep(3)} className="text-gray-400 text-sm active:opacity-70">← Back</button>
              <p className="text-white font-semibold">Review</p>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 text-center">
                <p className="text-white font-black text-2xl leading-none mb-1">{csvRows.length}</p>
                <p className="text-gray-500 text-xs uppercase tracking-wider">Total Rows</p>
              </div>
              <div className="bg-[#1A1A1A] border border-green-500/30 rounded-xl px-4 py-4 text-center">
                <p className="text-green-400 font-black text-2xl leading-none mb-1">{validRows.length}</p>
                <p className="text-gray-500 text-xs uppercase tracking-wider">Ready to Import</p>
              </div>
              <div className="bg-[#1A1A1A] border border-red-500/30 rounded-xl px-4 py-4 text-center">
                <p className="text-red-400 font-black text-2xl leading-none mb-1">{rowErrors.length}</p>
                <p className="text-gray-500 text-xs uppercase tracking-wider">Errors</p>
              </div>
            </div>

            {/* Errors */}
            {rowErrors.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-4 mb-6">
                <p className="text-red-400 font-semibold text-sm mb-2">Rows with errors (will be skipped)</p>
                <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                  {rowErrors.map((e, i) => (
                    <p key={i} className="text-red-300 text-xs">Row {e.row}: {e.message}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Preview of valid rows */}
            {validRows.length > 0 && (
              <div className="mb-6">
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Will import (first 5 shown)
                </p>
                <div className="overflow-x-auto rounded-xl border border-[#2a2a2a]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#141414]">
                        {fields.filter((f) => mapping[f.key]).map((f) => (
                          <th key={f.key} className="px-4 py-2.5 text-left text-gray-400 text-xs font-semibold uppercase tracking-wider whitespace-nowrap border-b border-[#2a2a2a]">
                            {f.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {validRows.slice(0, 5).map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-[#1A1A1A]" : "bg-[#161616]"}>
                          {fields.filter((f) => mapping[f.key]).map((f) => (
                            <td key={f.key} className="px-4 py-2.5 text-white max-w-[180px] truncate">
                              {row[f.key] || <span className="text-gray-600">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {validRows.length > 5 && (
                  <p className="text-gray-600 text-xs mt-2 px-1">…and {validRows.length - 5} more rows</p>
                )}
              </div>
            )}

            {importType === "labor" ? (
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-3 mb-4">
                <p className="text-orange-300 text-sm font-semibold mb-1">How deduplication works for labor</p>
                <ul className="text-gray-400 text-sm flex flex-col gap-1">
                  <li>• New crew members will be added to your Contacts with their trade and rate</li>
                  <li>• Existing contacts are matched by name — no duplicate records created</li>
                  <li>• Duplicate entries (same person + job + date) will be skipped</li>
                </ul>
              </div>
            ) : (
              <p className="text-gray-500 text-sm mb-4">
                Duplicates will be detected and skipped automatically during import.
              </p>
            )}

            {validRows.length === 0 ? (
              <button onClick={() => setStep(3)}
                className="w-full bg-[#1A1A1A] border border-[#2a2a2a] text-gray-400 font-semibold py-4 rounded-xl">
                Fix Errors ←
              </button>
            ) : (
              <button onClick={handleImport} disabled={importing}
                className="w-full bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50">
                {importing ? "Importing…" : `Import ${validRows.length} ${TYPE_CONFIG[importType].label}`}
              </button>
            )}
          </div>
        )}

        {/* ── STEP 5: Results ── */}
        {step === 5 && result && importType && (
          <div>
            <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-2xl px-6 py-6 mb-6">
              {/* Success icon */}
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h2 className="text-white font-black text-2xl text-center mb-6">Import Complete</h2>

              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center py-3 border-b border-[#2a2a2a]">
                  <span className="text-gray-300 text-base">{TYPE_CONFIG[importType].label} imported</span>
                  <span className="text-green-400 font-black text-2xl">{result.imported}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-[#2a2a2a]">
                  <span className="text-gray-300 text-base">Skipped (duplicates)</span>
                  <span className="text-yellow-400 font-bold text-xl">{result.skipped}</span>
                </div>
                {importType === "labor" && (result.contacts_created ?? 0) > 0 && (
                  <div className="flex justify-between items-center py-3 border-b border-[#2a2a2a]">
                    <span className="text-gray-300 text-base">New contacts created</span>
                    <span className="text-orange-400 font-bold text-xl">{result.contacts_created}</span>
                  </div>
                )}
                {result.errors.length > 0 && (
                  <div className="flex justify-between items-center py-3">
                    <span className="text-gray-300 text-base">Failed</span>
                    <span className="text-red-400 font-bold text-xl">{result.errors.length}</span>
                  </div>
                )}
              </div>

              {result.errors.length > 0 && (
                <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 max-h-40 overflow-y-auto">
                  {result.errors.slice(0, 10).map((e, i) => (
                    <p key={i} className="text-red-300 text-xs">{e}</p>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={reset}
                className="bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold py-4 rounded-xl active:scale-95 transition-transform">
                Import More
              </button>
              <Link href="/jobs"
                className="bg-orange-500 text-white font-bold py-4 rounded-xl active:scale-95 transition-transform flex items-center justify-center">
                Go to Dashboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
