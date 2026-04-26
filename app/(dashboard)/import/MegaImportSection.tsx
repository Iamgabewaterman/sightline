"use client";

import { useState, useRef, useCallback } from "react";
import { parseCSV } from "@/lib/parse-csv";
import { detectFileType, MegaImportType } from "@/lib/detect-file-type";
import { runMegaImport, MegaFileInput, MegaImportSummary } from "@/app/actions/mega-import";
import { extractPdfAsRows } from "@/app/actions/pdf-import";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ParsedFile {
  fileName: string;
  detectedType: MegaImportType;
  rows: Record<string, string>[];
  headers: string[];
}

type Step = "upload" | "preview" | "importing" | "done";

const TYPE_LABELS: Record<MegaImportType, string> = {
  clients:   "Clients",
  jobs:      "Jobs",
  materials: "Materials",
  labor:     "Labor Logs",
  expenses:  "Expenses",
  contacts:  "Crew Contacts",
  unknown:   "Unrecognized",
};

const TYPE_COLORS: Record<MegaImportType, string> = {
  clients:   "text-blue-400",
  jobs:      "text-orange-400",
  materials: "text-green-400",
  labor:     "text-purple-400",
  expenses:  "text-yellow-400",
  contacts:  "text-cyan-400",
  unknown:   "text-gray-500",
};

// ── ZIP extraction (no library — DecompressionStream STORE-mode) ──────────────

async function extractZip(buffer: ArrayBuffer): Promise<{ name: string; data: string }[]> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const results: { name: string; data: string }[] = [];
  let i = 0;

  while (i < bytes.length - 4) {
    const sig = view.getUint32(i, true);
    if (sig !== 0x04034b50) break; // local file header signature

    const compression = view.getUint16(i + 8, true);
    const compressedSize = view.getUint32(i + 18, true);
    const nameLen = view.getUint16(i + 26, true);
    const extraLen = view.getUint16(i + 28, true);

    const nameBytes = bytes.slice(i + 30, i + 30 + nameLen);
    const name = new TextDecoder().decode(nameBytes);
    const dataStart = i + 30 + nameLen + extraLen;
    const compressedData = bytes.slice(dataStart, dataStart + compressedSize);

    if (name.endsWith(".csv")) {
      if (compression === 0) {
        // STORE — raw bytes
        results.push({ name, data: new TextDecoder("utf-8").decode(compressedData) });
      } else if (compression === 8) {
        // DEFLATE
        try {
          const ds = new DecompressionStream("deflate-raw");
          const writer = ds.writable.getWriter();
          writer.write(compressedData);
          writer.close();
          const chunks: Uint8Array[] = [];
          const reader = ds.readable.getReader();
          let done = false;
          while (!done) {
            const { value, done: d } = await reader.read();
            if (value) chunks.push(value);
            done = d;
          }
          const total = chunks.reduce((n, c) => n + c.length, 0);
          const out = new Uint8Array(total);
          let off = 0;
          for (const c of chunks) { out.set(c, off); off += c.length; }
          results.push({ name, data: new TextDecoder("utf-8").decode(out) });
        } catch {
          // Skip unreadable entries
        }
      }
    }

    i = dataStart + compressedSize;
  }

  return results;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MegaImportSection() {
  const [step, setStep] = useState<Step>("upload");
  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([]);
  const [overrides, setOverrides] = useState<Record<string, MegaImportType>>({});
  const [summary, setSummary] = useState<MegaImportSummary | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [pdfProcessing, setPdfProcessing] = useState(false);

  const processFiles = useCallback(async (fileList: FileList) => {
    const parsed: ParsedFile[] = [];
    for (const file of Array.from(fileList)) {
      if (file.name.endsWith(".zip")) {
        const buf = await file.arrayBuffer();
        const csvFiles = await extractZip(buf);
        for (const { name, data } of csvFiles) {
          const { headers, rows } = parseCSV(data);
          if (rows.length === 0) continue;
          parsed.push({ fileName: name, detectedType: detectFileType(headers), rows, headers });
        }
      } else if (file.name.endsWith(".csv")) {
        const text = await file.text();
        const { headers, rows } = parseCSV(text);
        if (rows.length === 0) continue;
        parsed.push({ fileName: file.name, detectedType: detectFileType(headers), rows, headers });
      } else if (file.name.toLowerCase().endsWith(".pdf")) {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let b = 0; b < bytes.byteLength; b++) binary += String.fromCharCode(bytes[b]);
        const base64 = btoa(binary);
        setPdfProcessing(true);
        const result = await extractPdfAsRows(base64);
        setPdfProcessing(false);
        if (result.error || result.rows.length === 0) continue;
        parsed.push({ fileName: file.name, detectedType: result.detectedType, rows: result.rows, headers: result.headers });
      }
    }

    if (parsed.length === 0) return;
    setParsedFiles(parsed);
    setOverrides({});
    setStep("preview");
  }, []);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) processFiles(e.target.files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
  };

  const getType = (f: ParsedFile) => overrides[f.fileName] ?? f.detectedType;

  const totalRows = parsedFiles.reduce((n, f) => n + f.rows.length, 0);

  async function handleImport() {
    setImporting(true);
    setStep("importing");

    const input: MegaFileInput[] = parsedFiles.map((f) => ({
      fileName: f.fileName,
      detectedType: getType(f),
      rows: f.rows,
    }));

    const result = await runMegaImport(input);
    setSummary(result);
    setStep("done");
    setImporting(false);
  }

  function reset() {
    setStep("upload");
    setParsedFiles([]);
    setOverrides({});
    setSummary(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  // ── Upload ────────────────────────────────────────────────────────────────

  if (step === "upload") {
    return (
      <div className="bg-[#1A1A1A] border border-orange-500/30 rounded-xl p-5 mb-6">
        <div className="mb-4">
          <p className="text-orange-500 text-xs font-bold uppercase tracking-widest mb-1">Full History Import — Start Here</p>
          <h2 className="text-white font-bold text-xl leading-tight mb-1">Import Everything at Once</h2>
          <p className="text-gray-400 text-sm">
            Transfer everything from QuickBooks, spreadsheets, or your existing system in one upload. Sightline will organize it automatically.
          </p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl py-10 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
            dragOver ? "border-orange-500 bg-orange-500/5" : "border-[#333] hover:border-orange-500/50"
          }`}
        >
          <span className="text-4xl">📂</span>
          <p className="text-white font-semibold text-base">Drop files here</p>
          <p className="text-gray-500 text-sm text-center px-4">
            CSV, ZIP, or PDF — QuickBooks exports, Leap CRM, invoices, estimates
          </p>
          {pdfProcessing && (
            <p className="text-orange-400 text-sm animate-pulse">Extracting PDF with AI...</p>
          )}
          <span className="bg-orange-500 text-white font-bold text-sm px-5 py-3 rounded-xl mt-1">
            Choose Files
          </span>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,.zip,.pdf"
          multiple
          className="hidden"
          onChange={handleFiles}
        />

        {/* Template download */}
        <div className="mt-4 flex items-center justify-between">
          <p className="text-gray-500 text-xs">Not sure what format? Download our templates.</p>
          <a
            href="/api/templates/pack"
            download="sightline-import-templates.zip"
            className="text-orange-500 text-xs font-semibold underline"
            onClick={(e) => e.stopPropagation()}
          >
            Download Templates
          </a>
        </div>
      </div>
    );
  }

  // ── Preview ───────────────────────────────────────────────────────────────

  if (step === "preview") {
    const unknownCount = parsedFiles.filter((f) => getType(f) === "unknown").length;

    return (
      <div className="bg-[#1A1A1A] border border-orange-500/30 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-orange-500 text-xs font-bold uppercase tracking-widest mb-1">Review Before Importing</p>
            <h2 className="text-white font-bold text-xl">{parsedFiles.length} file{parsedFiles.length !== 1 ? "s" : ""} · {totalRows.toLocaleString()} records</h2>
          </div>
          <button onClick={reset} className="text-gray-500 text-sm underline">Start over</button>
        </div>

        {unknownCount > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3 mb-4">
            <p className="text-yellow-400 text-sm font-semibold">
              {unknownCount} file{unknownCount !== 1 ? "s" : ""} couldn't be auto-detected — choose a type below or they'll be skipped.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3 mb-5">
          {parsedFiles.map((f) => {
            const type = getType(f);
            return (
              <div key={f.fileName} className="bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{f.fileName}</p>
                    <p className="text-gray-500 text-xs">{f.rows.length} rows</p>
                  </div>
                  <select
                    value={type}
                    onChange={(e) => setOverrides((prev) => ({ ...prev, [f.fileName]: e.target.value as MegaImportType }))}
                    className={`bg-[#1A1A1A] border border-[#333] rounded-lg px-2 py-1.5 text-xs font-semibold shrink-0 ${TYPE_COLORS[type]}`}
                  >
                    {(Object.keys(TYPE_LABELS) as MegaImportType[]).map((t) => (
                      <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>

                {/* Sample rows */}
                {f.rows.slice(0, 2).map((row, i) => (
                  <div key={i} className="text-gray-600 text-xs truncate">
                    {Object.entries(row).slice(0, 3).map(([k, v]) => v ? `${k}: ${v}` : null).filter(Boolean).join(" · ")}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <button
          onClick={handleImport}
          disabled={importing}
          className="w-full bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
        >
          Import {totalRows.toLocaleString()} Records
        </button>
      </div>
    );
  }

  // ── Importing ─────────────────────────────────────────────────────────────

  if (step === "importing") {
    return (
      <div className="bg-[#1A1A1A] border border-orange-500/30 rounded-xl p-5 mb-6 flex flex-col items-center gap-4 py-12">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-white font-semibold">Importing your data…</p>
        <p className="text-gray-500 text-sm text-center">This may take a moment. Don't close the app.</p>
      </div>
    );
  }

  // ── Done ─────────────────────────────────────────────────────────────────

  if (step === "done" && summary) {
    const types: Array<{ key: keyof Omit<MegaImportSummary, "needsReview" | "errors">; label: string }> = [
      { key: "clients",   label: "Clients" },
      { key: "jobs",      label: "Jobs" },
      { key: "materials", label: "Materials" },
      { key: "labor",     label: "Labor Logs" },
      { key: "expenses",  label: "Expenses" },
      { key: "contacts",  label: "Crew Contacts" },
    ];

    const totalImported = types.reduce((n, t) => n + summary[t.key].imported, 0);
    const totalSkipped  = types.reduce((n, t) => n + summary[t.key].skipped,  0);

    return (
      <div className="bg-[#1A1A1A] border border-orange-500/30 rounded-xl p-5 mb-6">
        <div className="mb-5">
          <p className="text-green-400 text-xs font-bold uppercase tracking-widest mb-1">Import Complete</p>
          <h2 className="text-white font-bold text-2xl">{totalImported.toLocaleString()} records imported</h2>
          {totalSkipped > 0 && (
            <p className="text-gray-500 text-sm mt-1">{totalSkipped} duplicates skipped</p>
          )}
        </div>

        {/* Breakdown */}
        <div className="flex flex-col gap-2 mb-5">
          {types.filter((t) => summary[t.key].imported > 0 || summary[t.key].skipped > 0).map((t) => (
            <div key={t.key} className="flex justify-between items-center py-2 border-b border-[#222] last:border-0">
              <span className="text-gray-400 text-sm">{t.label}</span>
              <div className="flex gap-3">
                <span className="text-white font-semibold text-sm">{summary[t.key].imported} imported</span>
                {summary[t.key].skipped > 0 && (
                  <span className="text-gray-600 text-sm">{summary[t.key].skipped} skipped</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Needs review */}
        {summary.needsReview.length > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3 mb-4">
            <p className="text-yellow-400 text-sm font-semibold mb-2">Needs review ({summary.needsReview.length})</p>
            {summary.needsReview.slice(0, 5).map((item, i) => (
              <p key={i} className="text-yellow-300/70 text-xs mb-1">• {item.reason}</p>
            ))}
            {summary.needsReview.length > 5 && (
              <p className="text-yellow-300/50 text-xs">…and {summary.needsReview.length - 5} more</p>
            )}
          </div>
        )}

        {/* Errors */}
        {summary.errors.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-4">
            <p className="text-red-400 text-sm font-semibold mb-2">Errors ({summary.errors.length})</p>
            {summary.errors.slice(0, 3).map((e, i) => (
              <p key={i} className="text-red-300/70 text-xs mb-1">• {e}</p>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <a
            href="/jobs"
            className="flex-1 bg-orange-500 text-white font-bold text-base py-4 rounded-xl text-center active:scale-95 transition-transform"
          >
            View Your Data
          </a>
          <button
            onClick={reset}
            className="px-5 py-4 bg-[#111] border border-[#2a2a2a] text-gray-400 font-semibold text-sm rounded-xl active:scale-95 transition-transform"
          >
            Import More
          </button>
        </div>
      </div>
    );
  }

  return null;
}
