"use client";

import { useState, useRef } from "react";
import { ContactCOI, COIStatus, getCOIStatus } from "@/types";
import { saveCOI, deleteCOI } from "@/app/actions/coi";
import { createClient } from "@/lib/supabase/client";

interface Props {
  contactId: string;
  initialCOI: ContactCOI | null;
  onUpdated: (coi: ContactCOI | null) => void;
}

function statusColor(s: COIStatus) {
  if (s === "valid") return { dot: "bg-green-500", badge: "bg-green-900/40 text-green-400 border border-green-700/50", label: "Valid" };
  if (s === "expiring_soon") return { dot: "bg-yellow-400", badge: "bg-yellow-900/40 text-yellow-400 border border-yellow-700/50", label: "Expiring Soon" };
  if (s === "expired") return { dot: "bg-red-500", badge: "bg-red-900/40 text-red-400 border border-red-700/50", label: "Expired" };
  return { dot: "bg-gray-600", badge: "bg-[#242424] text-gray-500 border border-[#333]", label: "No COI" };
}

export function COIStatusDot({ expDate }: { expDate: string | null | undefined }) {
  const s = getCOIStatus(expDate);
  if (s === "none") return null;
  const { dot } = statusColor(s);
  return <span className={`inline-block w-2 h-2 rounded-full ${dot} shrink-0`} />;
}

export default function COISection({ contactId, initialCOI, onUpdated }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [coi, setCOI] = useState<ContactCOI | null>(initialCOI);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [carrier, setCarrier] = useState(coi?.carrier_name ?? "");
  const [policy, setPolicy] = useState(coi?.policy_number ?? "");
  const [coverage, setCoverage] = useState(coi?.coverage_amount?.toString() ?? "");
  const [expDate, setExpDate] = useState(coi?.expiration_date ?? "");

  const status = getCOIStatus(coi?.expiration_date);
  const { badge, label } = statusColor(status);

  function openEdit() {
    setCarrier(coi?.carrier_name ?? "");
    setPolicy(coi?.policy_number ?? "");
    setCoverage(coi?.coverage_amount?.toString() ?? "");
    setExpDate(coi?.expiration_date ?? "");
    setEditing(true);
    setError("");
  }

  async function handleSave() {
    setSaving(true); setError("");
    const result = await saveCOI(contactId, {
      carrier_name: carrier.trim() || null,
      policy_number: policy.trim() || null,
      coverage_amount: coverage ? parseFloat(coverage) : null,
      expiration_date: expDate || null,
      document_path: coi?.document_path ?? null,
    });
    if (result.error) { setError(result.error); setSaving(false); return; }
    const updated = result.coi ?? null;
    setCOI(updated);
    onUpdated(updated);
    setEditing(false);
    setSaving(false);
  }

  async function handleUpload(file: File) {
    if (!file) return;
    setUploading(true); setError("");
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "pdf";
    const path = `coi/${contactId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("job-documents").upload(path, file, { upsert: true });
    if (upErr) { setError(upErr.message); setUploading(false); return; }

    const result = await saveCOI(contactId, {
      carrier_name: coi?.carrier_name ?? null,
      policy_number: coi?.policy_number ?? null,
      coverage_amount: coi?.coverage_amount ?? null,
      expiration_date: coi?.expiration_date ?? null,
      document_path: path,
    });
    if (result.error) { setError(result.error); setUploading(false); return; }
    const updated = result.coi ?? null;
    setCOI(updated);
    onUpdated(updated);
    setUploading(false);
  }

  async function handleDelete() {
    if (!confirm("Remove COI record?")) return;
    await deleteCOI(contactId);
    setCOI(null);
    onUpdated(null);
    setEditing(false);
  }

  async function viewDocument() {
    if (!coi?.document_path) return;
    const supabase = createClient();
    const { data } = await supabase.storage.from("job-documents").createSignedUrl(coi.document_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  const inputCls = "bg-[#1A1A1A] border border-[#333] text-white rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-orange-500 w-full";

  return (
    <div className="mt-3 border border-[#2a2a2a] rounded-xl overflow-hidden">
      {/* Collapsed header */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#141414] active:bg-[#1e1e1e] transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
          <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Certificate of Insurance</span>
        </div>
        <div className="flex items-center gap-2">
          {coi?.expiration_date && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge}`}>{label}</span>
          )}
          {!coi && <span className="text-gray-600 text-xs">Not on file</span>}
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 py-4 bg-[#0F0F0F] border-t border-[#2a2a2a]">
          {!editing ? (
            <>
              {coi ? (
                <div className="flex flex-col gap-2 mb-3">
                  {coi.carrier_name && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 text-xs">Carrier</span>
                      <span className="text-white text-xs font-semibold">{coi.carrier_name}</span>
                    </div>
                  )}
                  {coi.policy_number && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 text-xs">Policy #</span>
                      <span className="text-white text-xs font-mono">{coi.policy_number}</span>
                    </div>
                  )}
                  {coi.coverage_amount != null && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 text-xs">Coverage</span>
                      <span className="text-white text-xs font-semibold">${Number(coi.coverage_amount).toLocaleString()}</span>
                    </div>
                  )}
                  {coi.expiration_date && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 text-xs">Expires</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white text-xs">{new Date(coi.expiration_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge}`}>{label}</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-600 text-xs mb-3">No COI on file for this subcontractor.</p>
              )}

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={openEdit}
                  className="text-orange-400 text-xs font-semibold bg-orange-500/10 border border-orange-500/20 px-3 py-2 rounded-lg active:scale-95 transition-transform min-h-[36px]"
                >
                  {coi ? "Edit" : "+ Add COI"}
                </button>
                {coi?.document_path && (
                  <button
                    onClick={viewDocument}
                    className="text-blue-400 text-xs font-semibold bg-blue-500/10 border border-blue-500/20 px-3 py-2 rounded-lg active:scale-95 transition-transform min-h-[36px]"
                  >
                    View Document
                  </button>
                )}
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="text-gray-300 text-xs font-semibold bg-[#1A1A1A] border border-[#2a2a2a] px-3 py-2 rounded-lg active:scale-95 transition-transform min-h-[36px] disabled:opacity-50"
                >
                  {uploading ? "Uploading..." : "Upload COI"}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
                />
                {coi && (
                  <button
                    onClick={handleDelete}
                    className="text-red-400 text-xs font-semibold px-3 py-2 rounded-lg border border-[#2a2a2a] active:scale-95 transition-transform min-h-[36px]"
                  >
                    Remove
                  </button>
                )}
              </div>
              {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Insurance Carrier</label>
                <input type="text" value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="e.g. State Farm, Liberty Mutual" className={inputCls} />
              </div>
              <div>
                <label className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Policy Number</label>
                <input type="text" value={policy} onChange={(e) => setPolicy(e.target.value)} placeholder="Policy #" className={inputCls} />
              </div>
              <div>
                <label className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Coverage Amount</label>
                <input type="number" inputMode="numeric" min="0" step="1000" value={coverage} onChange={(e) => setCoverage(e.target.value)} placeholder="e.g. 1000000" className={inputCls} />
              </div>
              <div>
                <label className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Expiration Date</label>
                <input type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} className={inputCls} />
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-orange-500 text-white font-bold py-3 rounded-xl active:scale-95 transition-transform disabled:opacity-50 text-sm"
                >
                  {saving ? "Saving..." : "Save COI"}
                </button>
                <button
                  onClick={() => { setEditing(false); setError(""); }}
                  className="px-4 py-3 bg-[#1A1A1A] border border-[#2a2a2a] text-gray-400 font-semibold rounded-xl active:scale-95 transition-transform text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
