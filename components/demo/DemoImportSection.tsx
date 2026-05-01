"use client";

import { useState, useRef, useCallback } from "react";
import { demoImportPreview, DemoImportPreviewResult } from "@/app/actions/demo-import-preview";

const QB_MOCK_HEADERS = ["Transaction Type", "Date", "Num", "Name", "Memo", "Account", "Split", "Debit", "Credit", "Class"];
const QB_MOCK_ROWS: Record<string, string>[] = [
  { "Transaction Type": "Bill", "Date": "04/18/2026", "Num": "1042", "Name": "Home Depot", "Memo": "Framing lumber – Martinez job", "Account": "Materials", "Split": "", "Debit": "847.32", "Credit": "", "Class": "Martinez Restoration" },
  { "Transaction Type": "Bill", "Date": "04/20/2026", "Num": "1043", "Name": "Parr Lumber", "Memo": "Roofing shingles & felt", "Account": "Materials", "Split": "", "Debit": "1240.00", "Credit": "", "Class": "Thompson Deck" },
  { "Transaction Type": "Check", "Date": "04/22/2026", "Num": "", "Name": "Mike Torres", "Memo": "Framing labor 24 hrs", "Account": "Labor", "Split": "", "Debit": "1248.00", "Credit": "", "Class": "Martinez Restoration" },
  { "Transaction Type": "Invoice", "Date": "04/15/2026", "Num": "INV-221", "Name": "Robert Thompson", "Memo": "Cedar Deck Build deposit", "Account": "Income", "Split": "", "Debit": "", "Credit": "6225.00", "Class": "Thompson Deck" },
];

const ORGANIZED_RESULT = {
  clients: [{ name: "Robert Thompson", company: "Thompson Properties LLC", phone: "(503) 842-1156" }],
  jobs: [{ name: "Martinez Restoration", status: "Active", type: "Fire & Flood" }, { name: "Thompson Deck", status: "Active", type: "Decks & Patios" }],
  expenses: [{ vendor: "Home Depot", amount: "$847.32", job: "Martinez Restoration" }, { vendor: "Parr Lumber", amount: "$1,240.00", job: "Thompson Deck" }],
};

function parseCSVText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = clean.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    return Object.fromEntries(headers.map((h, i) => [h, cols[i] ?? ""]));
  });
  return { headers, rows };
}

export default function DemoImportSection() {
  const [view, setView] = useState<"mock" | "live">("mock");
  const [liveResult, setLiveResult] = useState<DemoImportPreviewResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.name.endsWith(".csv")) {
      alert("Drop a .csv file to preview");
      return;
    }
    setProcessing(true);
    setLiveResult(null);
    const text = await file.text();
    const { headers, rows } = parseCSVText(text);
    if (rows.length === 0) { setProcessing(false); return; }
    const result = await demoImportPreview(file.name, headers, rows);
    setLiveResult(result);
    setView("live");
    setProcessing(false);
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-orange-500 text-xs font-bold uppercase tracking-widest mb-1">Zero Manual Mapping</p>
          <h2 className="text-white font-bold text-xl">MegaPort Import</h2>
        </div>
      </div>

      <p className="text-gray-400 text-sm mb-5">
        Drop in a CSV from QuickBooks, Jobber, Leap, or any platform — Sightline detects the format and organizes everything automatically.
      </p>

      {/* Tab toggle */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setView("mock")}
          className={`flex-1 py-3 rounded-xl font-bold text-sm transition-colors ${view === "mock" ? "bg-orange-500 text-white" : "bg-[#1A1A1A] text-gray-400 border border-[#2a2a2a]"}`}
        >
          Demo Preview
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={processing}
          className="flex-1 py-3 rounded-xl font-bold text-sm bg-[#1A1A1A] text-gray-400 border border-[#2a2a2a] active:scale-95 transition-transform disabled:opacity-50"
        >
          {processing ? "Reading…" : "Try Your File"}
        </button>
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => handleFile(e.target.files)} />
      </div>

      {/* Mock QB → Sightline before/after */}
      {view === "mock" && (
        <div className="flex flex-col gap-4">
          {/* Before */}
          <div className="bg-[#0e0e0e] border border-[#2a2a2a] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2a2a2a] flex items-center gap-2">
              <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">Before — QuickBooks CSV</span>
              <span className="bg-[#222] text-gray-600 text-[10px] px-2 py-0.5 rounded-full">raw export</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1e1e1e]">
                    {QB_MOCK_HEADERS.map((h) => (
                      <th key={h} className="text-gray-600 font-semibold text-left px-3 py-2 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1a1a]">
                  {QB_MOCK_ROWS.map((row, i) => (
                    <tr key={i}>
                      {QB_MOCK_HEADERS.map((h) => (
                        <td key={h} className="text-gray-500 px-3 py-2 whitespace-nowrap">{row[h] || ""}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center gap-3">
            <div className="flex-1 h-px bg-[#2a2a2a]" />
            <div className="bg-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">Sightline Organizes →</div>
            <div className="flex-1 h-px bg-[#2a2a2a]" />
          </div>

          {/* After */}
          <div className="flex flex-col gap-3">
            <div className="bg-[#1A1A1A] border border-blue-500/20 rounded-xl px-4 py-4">
              <p className="text-blue-400 text-xs font-bold uppercase tracking-wider mb-3">Clients</p>
              {ORGANIZED_RESULT.clients.map((c, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-sm">{c.name[0]}</div>
                  <div>
                    <p className="text-white font-semibold text-sm">{c.name}</p>
                    <p className="text-gray-500 text-xs">{c.company} · {c.phone}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-[#1A1A1A] border border-orange-500/20 rounded-xl px-4 py-4">
              <p className="text-orange-400 text-xs font-bold uppercase tracking-wider mb-3">Jobs</p>
              <div className="flex flex-col gap-2">
                {ORGANIZED_RESULT.jobs.map((j, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-semibold text-sm">{j.name}</p>
                      <p className="text-gray-500 text-xs">{j.type}</p>
                    </div>
                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-orange-500/15 text-orange-400">{j.status}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-[#1A1A1A] border border-yellow-500/20 rounded-xl px-4 py-4">
              <p className="text-yellow-400 text-xs font-bold uppercase tracking-wider mb-3">Expenses</p>
              <div className="flex flex-col gap-2">
                {ORGANIZED_RESULT.expenses.map((e, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-semibold text-sm">{e.vendor}</p>
                      <p className="text-gray-500 text-xs">{e.job}</p>
                    </div>
                    <span className="text-white font-bold text-sm">{e.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live result */}
      {view === "live" && liveResult && (
        <div className="flex flex-col gap-4">
          <div className="bg-[#1A1A1A] border border-green-500/30 rounded-xl px-4 py-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-green-400 font-bold text-sm">✓ File analyzed</span>
              <span className="text-gray-600 text-xs">— nothing saved</span>
            </div>
            <p className="text-white font-semibold text-base mb-1">{liveResult.fileName}</p>
            <div className="flex items-center gap-3 mb-3">
              {liveResult.platform !== "generic" && (
                <span className="bg-blue-500/20 text-blue-300 text-xs font-bold px-2 py-0.5 rounded-full">{liveResult.platform}</span>
              )}
              <span className="text-gray-500 text-xs capitalize">{liveResult.detectedType} data</span>
              <span className="text-gray-500 text-xs">· {liveResult.rowCount} rows</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {Object.entries(liveResult.organized).map(([key, count]) => (
                <div key={key} className={`text-center rounded-lg px-2 py-2 ${count > 0 ? "bg-orange-500/10 border border-orange-500/20" : "bg-[#111] border border-[#222]"}`}>
                  <p className={`font-bold text-lg ${count > 0 ? "text-orange-400" : "text-gray-700"}`}>{count}</p>
                  <p className={`text-[10px] capitalize ${count > 0 ? "text-gray-400" : "text-gray-700"}`}>{key}</p>
                </div>
              ))}
            </div>
          </div>

          {liveResult.sampleRows.length > 0 && (
            <div className="bg-[#0e0e0e] border border-[#2a2a2a] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#2a2a2a]">
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Sample Rows</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1e1e1e]">
                      {liveResult.headers.slice(0, 6).map((h) => (
                        <th key={h} className="text-gray-600 font-semibold text-left px-3 py-2 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a1a1a]">
                    {liveResult.sampleRows.slice(0, 3).map((row, i) => (
                      <tr key={i}>
                        {liveResult.headers.slice(0, 6).map((h) => (
                          <td key={h} className="text-gray-500 px-3 py-2 whitespace-nowrap">{row[h] || ""}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <button
            onClick={() => { setView("mock"); setLiveResult(null); }}
            className="text-gray-500 text-sm text-center underline"
          >
            ← Back to demo preview
          </button>
        </div>
      )}

      {/* CTA */}
      <div className="mt-5 bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-4 text-center">
        <p className="text-orange-400 font-bold text-sm mb-1">Supports QuickBooks, Jobber, Leap, JobNimbus, AccuLynx, ServiceTitan, Buildertrend, Houzz Pro</p>
        <p className="text-gray-500 text-xs">Sign up to run a real import — your data organizes itself in minutes.</p>
      </div>
    </div>
  );
}
