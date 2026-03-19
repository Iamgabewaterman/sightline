"use client";

import { useState, useEffect } from "react";
import { SubcontractorLog, Contact } from "@/types";
import { addSubcontractor, updateSubcontractor, deleteSubcontractor } from "@/app/actions/subcontractors";
import { useJobCost } from "@/components/JobCostContext";
import { createClient } from "@/lib/supabase/client";

const TRADES = [
  "General", "Drywall", "Framing", "Plumbing", "Paint", "Trim",
  "Roofing", "Tile", "Flooring", "Electrical", "HVAC", "Concrete", "Landscaping",
];

function fmt$(n: number) {
  return "$" + Math.round(n).toLocaleString();
}

function statusBadge(log: SubcontractorLog) {
  if (log.paid) return { label: "Paid", cls: "bg-green-900/40 text-green-400 border-green-800" };
  if (log.invoice_received) return { label: "Invoiced", cls: "bg-yellow-900/40 text-yellow-400 border-yellow-800" };
  return { label: "Pending", cls: "bg-[#2a2a2a] text-gray-400 border-[#3a3a3a]" };
}

const inputCls =
  "bg-[#242424] border border-[#333] text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500 w-full";

interface FormState {
  contact_id: string;
  company_name: string;
  trade: string;
  scope_description: string;
  quoted_amount: string;
  invoice_received: boolean;
  invoice_amount: string;
  paid: boolean;
  notes: string;
}

const blankForm = (): FormState => ({
  contact_id: "",
  company_name: "",
  trade: "",
  scope_description: "",
  quoted_amount: "",
  invoice_received: false,
  invoice_amount: "",
  paid: false,
  notes: "",
});

export default function SubcontractorsSection({
  jobId,
  initialLogs,
}: {
  jobId: string;
  initialLogs: SubcontractorLog[];
}) {
  const { setActualSubCost } = useJobCost();
  const [logs, setLogs] = useState<SubcontractorLog[]>(initialLogs);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blankForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Contact picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerContacts, setPickerContacts] = useState<Contact[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  // Sync sub cost to context
  useEffect(() => {
    const total = logs.reduce((s, l) => {
      const amt = l.invoice_received && l.invoice_amount != null
        ? Number(l.invoice_amount)
        : Number(l.quoted_amount ?? 0);
      return s + amt;
    }, 0);
    setActualSubCost(total);
  }, [logs, setActualSubCost]);

  async function openPicker() {
    setPickerOpen(true);
    setPickerLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("contacts")
      .select("*")
      .not("trade", "is", null)
      .order("name")
      .returns<Contact[]>();
    setPickerContacts(data ?? []);
    setPickerLoading(false);
  }

  function selectContact(c: Contact) {
    setForm((f) => ({
      ...f,
      contact_id: c.id,
      company_name: c.name,
      trade: c.trade ?? "",
    }));
    setPickerOpen(false);
  }

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function openAdd() {
    setForm(blankForm());
    setEditingId(null);
    setError("");
    setShowForm(true);
  }

  function openEdit(log: SubcontractorLog) {
    setForm({
      contact_id: log.contact_id ?? "",
      company_name: log.company_name,
      trade: log.trade ?? "",
      scope_description: log.scope_description ?? "",
      quoted_amount: log.quoted_amount != null ? String(log.quoted_amount) : "",
      invoice_received: log.invoice_received,
      invoice_amount: log.invoice_amount != null ? String(log.invoice_amount) : "",
      paid: log.paid,
      notes: log.notes ?? "",
    });
    setEditingId(log.id);
    setShowForm(true);
    setError("");
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setError("");
  }

  async function handleSave() {
    if (!form.company_name.trim()) { setError("Company name is required"); return; }
    setSaving(true);
    setError("");

    const fields = {
      contact_id: form.contact_id || null,
      company_name: form.company_name.trim(),
      trade: form.trade || null,
      scope_description: form.scope_description.trim() || null,
      quoted_amount: form.quoted_amount ? parseFloat(form.quoted_amount) : null,
      invoice_received: form.invoice_received,
      invoice_amount: form.invoice_received && form.invoice_amount ? parseFloat(form.invoice_amount) : null,
      paid: form.paid,
      notes: form.notes.trim() || null,
    };

    if (editingId) {
      const res = await updateSubcontractor(editingId, fields);
      if (res.error) { setError(res.error); setSaving(false); return; }
      setLogs((prev) => prev.map((l) => l.id === editingId ? res.log! : l));
    } else {
      const res = await addSubcontractor(jobId, fields);
      if (res.error) { setError(res.error); setSaving(false); return; }
      setLogs((prev) => [res.log!, ...prev]);
    }
    setSaving(false);
    cancelForm();
  }

  async function handleDelete() {
    if (!confirmDeleteId) return;
    setDeleting(true);
    await deleteSubcontractor(confirmDeleteId);
    setLogs((prev) => prev.filter((l) => l.id !== confirmDeleteId));
    setConfirmDeleteId(null);
    setDeleting(false);
  }

  const totalQuoted = logs.reduce((s, l) => s + Number(l.quoted_amount ?? 0), 0);
  const totalInvoiced = logs.filter((l) => l.invoice_received).reduce((s, l) => s + Number(l.invoice_amount ?? 0), 0);
  const totalPaid = logs.filter((l) => l.paid).reduce((s, l) => s + Number(l.invoice_amount ?? l.quoted_amount ?? 0), 0);

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-bold text-xl">Subcontractors</h2>
        <div className="flex items-center gap-2">
          {logs.length > 0 && (
            <span className="text-orange-500 font-bold text-base">{fmt$(totalQuoted)}</span>
          )}
          <button
            onClick={openAdd}
            className="text-white font-semibold text-sm bg-[#1A1A1A] border border-[#2a2a2a] px-4 py-3 rounded-xl active:scale-95 transition-transform"
          >
            + Add Sub
          </button>
        </div>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 mb-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
              {editingId ? "Edit Subcontractor" : "Add Subcontractor"}
            </p>
            <button
              onClick={openPicker}
              className="text-gray-400 text-xs font-semibold border border-[#2a2a2a] px-3 py-2 rounded-xl active:scale-95"
            >
              From Contacts
            </button>
          </div>

          <input
            value={form.company_name}
            onChange={(e) => setField("company_name", e.target.value)}
            placeholder="Company / contractor name *"
            className={inputCls}
          />

          <select
            value={form.trade}
            onChange={(e) => setField("trade", e.target.value)}
            className={inputCls + " appearance-none"}
          >
            <option value="">Trade (optional)</option>
            {TRADES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <textarea
            value={form.scope_description}
            onChange={(e) => setField("scope_description", e.target.value)}
            placeholder="Scope — what are they doing on this job?"
            rows={2}
            className={inputCls + " resize-none"}
          />

          <div>
            <label className="text-gray-400 text-xs uppercase tracking-wider block mb-1">Quoted Amount</label>
            <div className="flex items-center gap-2 bg-[#242424] border border-[#333] rounded-xl px-4 py-4">
              <span className="text-gray-500 text-sm">$</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={form.quoted_amount}
                onChange={(e) => setField("quoted_amount", e.target.value)}
                placeholder="0"
                className="flex-1 bg-transparent text-white text-base focus:outline-none"
              />
            </div>
          </div>

          {/* Invoice received toggle */}
          <button
            type="button"
            onClick={() => {
              setField("invoice_received", !form.invoice_received);
              if (form.invoice_received) setField("invoice_amount", "");
            }}
            className={`flex items-center justify-between px-4 py-4 rounded-xl border transition-colors ${
              form.invoice_received
                ? "border-orange-500/40 bg-orange-500/10"
                : "border-[#333] bg-[#242424]"
            }`}
          >
            <span className={`text-base font-semibold ${form.invoice_received ? "text-orange-400" : "text-gray-300"}`}>
              Invoice Received
            </span>
            <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${form.invoice_received ? "bg-orange-500 justify-end" : "bg-[#3a3a3a] justify-start"}`}>
              <div className="w-5 h-5 rounded-full bg-white shadow" />
            </div>
          </button>

          {form.invoice_received && (
            <div>
              <label className="text-gray-400 text-xs uppercase tracking-wider block mb-1">Invoice Amount</label>
              <div className="flex items-center gap-2 bg-[#242424] border border-[#333] rounded-xl px-4 py-4">
                <span className="text-gray-500 text-sm">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={form.invoice_amount}
                  onChange={(e) => setField("invoice_amount", e.target.value)}
                  placeholder="0"
                  className="flex-1 bg-transparent text-white text-base focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Paid toggle */}
          <button
            type="button"
            onClick={() => setField("paid", !form.paid)}
            className={`flex items-center justify-between px-4 py-4 rounded-xl border transition-colors ${
              form.paid
                ? "border-green-600/40 bg-green-600/10"
                : "border-[#333] bg-[#242424]"
            }`}
          >
            <span className={`text-base font-semibold ${form.paid ? "text-green-400" : "text-gray-300"}`}>
              Paid
            </span>
            <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${form.paid ? "bg-green-500 justify-end" : "bg-[#3a3a3a] justify-start"}`}>
              <div className="w-5 h-5 rounded-full bg-white shadow" />
            </div>
          </button>

          <textarea
            value={form.notes}
            onChange={(e) => setField("notes", e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className={inputCls + " resize-none"}
          />

          {error && <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-xl px-4 py-3">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-orange-500 text-white font-bold py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
            >
              {saving ? "Saving…" : editingId ? "Save Changes" : "Add Subcontractor"}
            </button>
            <button
              onClick={cancelForm}
              className="px-5 py-4 bg-[#242424] text-gray-400 font-semibold rounded-xl active:scale-95"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {logs.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl py-10 text-center">
          <p className="text-gray-500 text-sm">No subcontractors on this job</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {logs.map((log) => {
            const badge = statusBadge(log);
            const displayAmt = log.invoice_received && log.invoice_amount != null
              ? Number(log.invoice_amount)
              : Number(log.quoted_amount ?? 0);
            return (
              <div
                key={log.id}
                className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-semibold text-base">{log.company_name}</p>
                      {log.trade && (
                        <span className="text-orange-500 text-xs font-semibold bg-orange-500/10 px-2 py-0.5 rounded-full">
                          {log.trade}
                        </span>
                      )}
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                    {log.scope_description && (
                      <p className="text-gray-400 text-sm mt-1 line-clamp-2">{log.scope_description}</p>
                    )}
                  </div>
                  <div className="flex gap-2 ml-3 shrink-0">
                    <button
                      onClick={() => openEdit(log)}
                      className="text-gray-400 text-sm px-3 py-3 rounded-xl border border-[#2a2a2a] active:scale-95"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(log.id)}
                      className="text-red-400 text-sm px-3 py-3 rounded-xl border border-[#2a2a2a] active:scale-95"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Cost grid */}
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="bg-[#242424] rounded-lg py-2 px-3">
                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-0.5">Quoted</p>
                    <p className="text-white font-semibold">
                      {log.quoted_amount != null ? fmt$(Number(log.quoted_amount)) : "—"}
                    </p>
                  </div>
                  <div className="bg-[#242424] rounded-lg py-2 px-3">
                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-0.5">
                      {log.invoice_received ? "Invoiced" : "Invoice"}
                    </p>
                    <p className={`font-semibold ${log.invoice_received ? "text-orange-400" : "text-gray-600"}`}>
                      {log.invoice_received && log.invoice_amount != null
                        ? fmt$(Number(log.invoice_amount))
                        : "—"}
                    </p>
                  </div>
                </div>

                {log.notes && (
                  <p className="text-gray-600 text-xs mt-2">{log.notes}</p>
                )}
              </div>
            );
          })}

          {/* Summary */}
          {logs.length > 1 && (
            <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Total quoted</span>
                <span className="text-white font-semibold">{fmt$(totalQuoted)}</span>
              </div>
              {totalInvoiced > 0 && (
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Total invoiced</span>
                  <span className="text-orange-400 font-semibold">{fmt$(totalInvoiced)}</span>
                </div>
              )}
              {totalPaid > 0 && (
                <div className="flex justify-between text-sm border-t border-[#2a2a2a] pt-2">
                  <span className="text-gray-400">Total paid</span>
                  <span className="text-green-400 font-bold">{fmt$(totalPaid)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Contact picker overlay */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 bg-[#0A0A0A] flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between px-5 pt-6 pb-4 shrink-0 border-b border-[#2a2a2a]">
            <div>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">From Saved</p>
              <h2 className="text-white font-bold text-xl">Select Contact</h2>
            </div>
            <button
              onClick={() => setPickerOpen(false)}
              className="text-gray-400 text-3xl leading-none w-11 h-11 flex items-center justify-center active:scale-95"
            >
              ×
            </button>
          </div>
          {pickerLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-500 animate-pulse">Loading…</p>
            </div>
          ) : pickerContacts.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-gray-500 text-base">No trade contacts yet</p>
                <p className="text-gray-600 text-sm mt-2">Add contacts with a trade in People</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 px-5 py-5 flex flex-col gap-2">
              {pickerContacts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectContact(c)}
                  className="w-full flex items-center justify-between bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 active:scale-95 transition-transform text-left"
                >
                  <div>
                    <p className="text-white font-semibold text-base">{c.name}</p>
                    <div className="flex gap-2 mt-0.5">
                      {c.trade && <span className="text-orange-500 text-xs">{c.trade}</span>}
                      {c.is_subcontractor && (
                        <span className="text-purple-400 text-xs font-semibold">Sub</span>
                      )}
                    </div>
                  </div>
                  <span className="text-gray-600 text-xl">→</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setConfirmDeleteId(null)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl px-5 pt-6"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
          >
            <p className="text-white font-bold text-lg mb-1">Remove subcontractor?</p>
            <p className="text-gray-400 text-sm mb-6">This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold py-4 rounded-xl active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white font-bold py-4 rounded-xl active:scale-95 disabled:opacity-50"
              >
                {deleting ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
