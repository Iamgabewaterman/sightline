"use client";

import { useState, useEffect, useMemo } from "react";
import { addLaborLog, updateLaborLog, deleteLaborLog } from "@/app/actions/labor";
import { addSubcontractor, updateSubcontractor, deleteSubcontractor } from "@/app/actions/subcontractors";
import { LaborLog, Contact, CrewWithMembers, SubcontractorLog, ContactCOI, getCOIStatus } from "@/types";
import { enqueue } from "@/hooks/useOfflineQueue";
import { useJobCost } from "@/components/JobCostContext";
import { createClient } from "@/lib/supabase/client";
import { useRole } from "@/hooks/useRole";
import Avatar from "@/components/Avatar";
import JobImportModal from "@/components/JobImportModal";

// ─── Constants ────────────────────────────────────────────────────────────────

const TRADES = [
  "General", "Drywall", "Framing", "Plumbing", "Paint", "Trim",
  "Roofing", "Tile", "Flooring", "Electrical", "HVAC", "Concrete", "Landscaping",
];

// ─── Sub form state ────────────────────────────────────────────────────────────

interface SubFormState {
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

const blankSubForm = (): SubFormState => ({
  contact_id: "", company_name: "", trade: "", scope_description: "",
  quoted_amount: "", invoice_received: false, invoice_amount: "", paid: false, notes: "",
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number) { return "$" + Math.round(n).toLocaleString(); }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function subStatusBadge(log: SubcontractorLog) {
  if (log.paid) return { label: "Paid", cls: "bg-green-900/40 text-green-400 border-green-800" };
  if (log.invoice_received) return { label: "Invoiced", cls: "bg-yellow-900/40 text-yellow-400 border-yellow-800" };
  return { label: "Pending", cls: "bg-[#2a2a2a] text-gray-400 border-[#3a3a3a]" };
}

const inputCls = "bg-[#242424] border border-[#333333] text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500 w-full";

// ─── LaborNameAutocomplete ─────────────────────────────────────────────────────

function LaborNameAutocomplete({
  value, onChange, onSelectContact, contacts, onLoadContacts, contactsLoaded,
}: {
  value: string; onChange: (v: string) => void;
  onSelectContact: (c: Contact) => void;
  contacts: Contact[]; onLoadContacts: () => void; contactsLoaded: boolean;
}) {
  const [open, setOpen] = useState(false);
  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (q.length < 1) return [];
    return contacts.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [value, contacts]);

  return (
    <div className="relative">
      <input
        type="text" required autoComplete="off"
        placeholder="Crew name (e.g. Mike, Sub crew, You)"
        value={value} onChange={(e) => onChange(e.target.value)}
        onFocus={() => { setOpen(true); if (!contactsLoaded) onLoadContacts(); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoCapitalize="words" autoCorrect="on"
        className="w-full bg-[#242424] border border-[#333333] text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl overflow-hidden z-40 shadow-xl">
          {suggestions.map((c) => (
            <button key={c.id} type="button"
              onMouseDown={() => { onSelectContact(c); setOpen(false); }}
              className="w-full text-left px-4 py-3 text-white text-base active:bg-[#242424] flex items-center justify-between"
            >
              <span>{c.name}</span>
              <span className="text-gray-500 text-sm">
                {c.trade ?? ""}{c.trade && c.hourly_rate !== null ? " · " : ""}
                {c.hourly_rate !== null ? `$${Number(c.hourly_rate)}/hr` : ""}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function LaborSubsSection({
  jobId,
  initialLogs,
  initialSubLogs,
  jobTypes = [],
}: {
  jobId: string;
  initialLogs: LaborLog[];
  initialSubLogs: SubcontractorLog[];
  jobTypes?: string[];
}) {
  const [activeTab, setActiveTab] = useState<"labor" | "subs">("labor");

  // ═══ LABOR STATE ════════════════════════════════════════════════════════════
  const { role, can_see_financials } = useRole();
  const [laborLogs, setLaborLogs] = useState<LaborLog[]>(initialLogs);
  const { setActualLaborCost, setActualSubCost, openLaborForm, setOpenLaborForm } = useJobCost();

  useEffect(() => {
    setActualLaborCost(laborLogs.reduce((s, l) => s + Number(l.hours) * Number(l.rate), 0));
  }, [laborLogs, setActualLaborCost]);

  const [showLaborForm, setShowLaborForm] = useState(false);
  useEffect(() => {
    if (!openLaborForm) return;
    setOpenLaborForm(false);
    setActiveTab("labor");
    setShowLaborForm(true);
  }, [openLaborForm, setOpenLaborForm]);

  const [showImport, setShowImport] = useState(false);
  const [laborSaving, setLaborSaving] = useState(false);
  const [laborFormError, setLaborFormError] = useState("");
  const [laborEditingId, setLaborEditingId] = useState<string | null>(null);
  const [laborEditError, setLaborEditError] = useState("");
  const [formName, setFormName] = useState("");
  const [formHours, setFormHours] = useState("");
  const [formRate, setFormRate] = useState("");
  const [formTrade, setFormTrade] = useState("");
  const [formKey, setFormKey] = useState(0);
  const [acContacts, setAcContacts] = useState<Contact[]>([]);
  const [acLoaded, setAcLoaded] = useState(false);
  const [showLaborPicker, setShowLaborPicker] = useState(false);
  const [laborPickerLoading, setLaborPickerLoading] = useState(false);
  const [laborPickerContacts, setLaborPickerContacts] = useState<Contact[]>([]);
  const [laborPickerCrews, setLaborPickerCrews] = useState<CrewWithMembers[]>([]);

  async function loadAcContacts() {
    if (acLoaded) return;
    const supabase = createClient();
    const { data } = await supabase.from("contacts").select("id, name, hourly_rate, trade").order("name").returns<Contact[]>();
    setAcContacts(data ?? []);
    setAcLoaded(true);
  }

  async function handleSelectAutoContact(contact: Contact) {
    setFormName(contact.name);
    if (contact.hourly_rate !== null) {
      setFormRate(String(contact.hourly_rate));
    } else {
      const supabase = createClient();
      const { data } = await supabase.from("labor_logs").select("rate").eq("crew_name", contact.name).order("created_at", { ascending: false }).limit(1);
      if (data && data.length > 0) setFormRate(String(data[0].rate));
    }
  }

  async function openLaborPicker() {
    setShowLaborPicker(true);
    setLaborPickerLoading(true);
    const supabase = createClient();
    const [{ data: contacts }, { data: crews }] = await Promise.all([
      supabase.from("contacts").select("*").order("name").returns<Contact[]>(),
      supabase.from("crews").select("*, crew_members(contact_id)").order("name").returns<CrewWithMembers[]>(),
    ]);
    setLaborPickerContacts(contacts ?? []);
    setLaborPickerCrews(crews ?? []);
    setLaborPickerLoading(false);
    if (!acLoaded) { setAcContacts(contacts ?? []); setAcLoaded(true); }
  }

  function selectLaborContact(contact: Contact) {
    setFormName(contact.name);
    setFormRate(contact.hourly_rate !== null ? String(contact.hourly_rate) : "");
    setShowLaborPicker(false);
    setShowLaborForm(true);
  }

  function selectLaborCrew(crew: CrewWithMembers, contacts: Contact[]) {
    const byId = new Map(contacts.map((c) => [c.id, c]));
    const members = crew.crew_members.map((m) => byId.get(m.contact_id)).filter(Boolean) as Contact[];
    const rate = members.reduce((s, m) => s + (m.hourly_rate ? Number(m.hourly_rate) : 0), 0);
    setFormName(crew.name);
    setFormRate(rate > 0 ? String(rate) : "");
    setShowLaborPicker(false);
    setShowLaborForm(true);
  }

  async function handleLaborAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLaborSaving(true);
    setLaborFormError("");
    if (!navigator.onLine) {
      enqueue({ type: "add_labor", payload: { jobId, crew_name: formName, hours: formHours, rate: formRate } });
      const optimistic: LaborLog = {
        id: `offline-${Date.now()}`, job_id: jobId, crew_name: formName,
        hours: formHours as unknown as number, rate: formRate as unknown as number,
        category: "labor", trade: formTrade || null, created_at: new Date().toISOString(),
      };
      setLaborLogs((p) => [optimistic, ...p]);
      setFormName(""); setFormHours(""); setFormRate(""); setFormKey((k) => k + 1); setShowLaborForm(false);
      setLaborSaving(false); return;
    }
    const fd = new FormData();
    fd.set("crew_name", formName); fd.set("hours", formHours); fd.set("rate", formRate);
    if (formTrade) fd.set("trade", formTrade);
    const result = await addLaborLog(jobId, fd);
    if (result.error) { setLaborFormError(result.error); }
    else if (result.log) {
      setLaborLogs((p) => [result.log!, ...p]);
      setFormName(""); setFormHours(""); setFormRate(""); setFormTrade(""); setFormKey((k) => k + 1); setShowLaborForm(false);
    }
    setLaborSaving(false);
  }

  async function handleLaborEdit(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    setLaborSaving(true); setLaborEditError("");
    const fd = new FormData(e.currentTarget);
    const result = await updateLaborLog(id, fd);
    if (result.error) { setLaborEditError(result.error); }
    else if (result.log) { setLaborLogs((p) => p.map((l) => l.id === id ? result.log! : l)); setLaborEditingId(null); }
    setLaborSaving(false);
  }

  async function handleLaborDelete(id: string) {
    if (!confirm("Remove this labor entry?")) return;
    const res = await deleteLaborLog(id);
    if (res.error) { alert(res.error); return; }
    setLaborLogs((p) => p.filter((l) => l.id !== id));
  }

  const totalLaborHours = laborLogs.reduce((s, l) => s + Number(l.hours), 0);
  const totalLaborCost = laborLogs.reduce((s, l) => s + Number(l.hours) * Number(l.rate), 0);

  // ═══ SUB STATE ══════════════════════════════════════════════════════════════
  const [subLogs, setSubLogs] = useState<SubcontractorLog[]>(initialSubLogs);

  useEffect(() => {
    const total = subLogs.reduce((s, l) => {
      const amt = l.invoice_received && l.invoice_amount != null ? Number(l.invoice_amount) : Number(l.quoted_amount ?? 0);
      return s + amt;
    }, 0);
    setActualSubCost(total);
  }, [subLogs, setActualSubCost]);

  const [showSubForm, setShowSubForm] = useState(false);
  const [subEditingId, setSubEditingId] = useState<string | null>(null);
  const [subForm, setSubForm] = useState<SubFormState>(blankSubForm());
  const [subSaving, setSubSaving] = useState(false);
  const [subError, setSubError] = useState("");
  const [confirmSubDeleteId, setConfirmSubDeleteId] = useState<string | null>(null);
  const [subDeleting, setSubDeleting] = useState(false);
  const [subPickerOpen, setSubPickerOpen] = useState(false);
  const [subPickerContacts, setSubPickerContacts] = useState<Contact[]>([]);
  const [subPickerLoading, setSubPickerLoading] = useState(false);
  const [subCoiMap, setSubCoiMap] = useState<Map<string, ContactCOI>>(new Map());
  const [subCoiWarningContact, setSubCoiWarningContact] = useState<Contact | null>(null);

  function setSubField<K extends keyof SubFormState>(k: K, v: SubFormState[K]) {
    setSubForm((f) => ({ ...f, [k]: v }));
  }

  async function openSubPicker() {
    setSubPickerOpen(true);
    setSubPickerLoading(true);
    const supabase = createClient();
    const [{ data: contacts }, { data: coiRecords }] = await Promise.all([
      supabase.from("contacts").select("*").not("trade", "is", null).order("name").returns<Contact[]>(),
      supabase.from("contact_coi").select("*").returns<ContactCOI[]>(),
    ]);
    setSubPickerContacts(contacts ?? []);
    setSubCoiMap(new Map((coiRecords ?? []).map((c) => [c.contact_id, c])));
    setSubPickerLoading(false);
  }

  function selectSubContact(c: Contact) {
    const coi = subCoiMap.get(c.id);
    const status = getCOIStatus(coi?.expiration_date);
    if (status === "expired") { setSubCoiWarningContact(c); setSubPickerOpen(false); return; }
    commitSelectSubContact(c);
  }

  function commitSelectSubContact(c: Contact) {
    setSubForm((f) => ({ ...f, contact_id: c.id, company_name: c.name, trade: c.trade ?? "" }));
    setSubPickerOpen(false); setSubCoiWarningContact(null);
  }

  function openSubAdd() {
    setSubForm(blankSubForm()); setSubEditingId(null); setSubError(""); setShowSubForm(true);
  }

  function openSubEdit(log: SubcontractorLog) {
    setSubForm({
      contact_id: log.contact_id ?? "", company_name: log.company_name, trade: log.trade ?? "",
      scope_description: log.scope_description ?? "", quoted_amount: log.quoted_amount != null ? String(log.quoted_amount) : "",
      invoice_received: log.invoice_received, invoice_amount: log.invoice_amount != null ? String(log.invoice_amount) : "",
      paid: log.paid, notes: log.notes ?? "",
    });
    setSubEditingId(log.id); setShowSubForm(true); setSubError("");
  }

  function cancelSubForm() { setShowSubForm(false); setSubEditingId(null); setSubError(""); }

  async function handleSubSave() {
    if (!subForm.company_name.trim()) { setSubError("Company name is required"); return; }
    setSubSaving(true); setSubError("");
    const fields = {
      contact_id: subForm.contact_id || null, company_name: subForm.company_name.trim(),
      trade: subForm.trade || null, scope_description: subForm.scope_description.trim() || null,
      quoted_amount: subForm.quoted_amount ? parseFloat(subForm.quoted_amount) : null,
      invoice_received: subForm.invoice_received,
      invoice_amount: subForm.invoice_received && subForm.invoice_amount ? parseFloat(subForm.invoice_amount) : null,
      paid: subForm.paid, notes: subForm.notes.trim() || null,
    };
    if (subEditingId) {
      const res = await updateSubcontractor(subEditingId, fields);
      if (res.error) { setSubError(res.error); setSubSaving(false); return; }
      setSubLogs((p) => p.map((l) => l.id === subEditingId ? res.log! : l));
    } else {
      const res = await addSubcontractor(jobId, fields);
      if (res.error) { setSubError(res.error); setSubSaving(false); return; }
      setSubLogs((p) => [res.log!, ...p]);
    }
    setSubSaving(false); cancelSubForm();
  }

  async function handleSubDelete() {
    if (!confirmSubDeleteId) return;
    setSubDeleting(true);
    await deleteSubcontractor(confirmSubDeleteId);
    setSubLogs((p) => p.filter((l) => l.id !== confirmSubDeleteId));
    setConfirmSubDeleteId(null); setSubDeleting(false);
  }

  const totalSubQuoted = subLogs.reduce((s, l) => s + Number(l.quoted_amount ?? 0), 0);
  const totalSubInvoiced = subLogs.filter((l) => l.invoice_received).reduce((s, l) => s + Number(l.invoice_amount ?? 0), 0);
  const totalSubPaid = subLogs.filter((l) => l.paid).reduce((s, l) => s + Number(l.invoice_amount ?? l.quoted_amount ?? 0), 0);

  // ═══ RENDER ═════════════════════════════════════════════════════════════════

  const tabBtn = (tab: "labor" | "subs") => {
    const active = activeTab === tab;
    return `flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${active ? "bg-[#2a2a2a] text-white" : "text-gray-500 hover:text-gray-300"}`;
  };

  return (
    <div>
      {/* Tab switcher + add button */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 flex gap-1 bg-[#141414] border border-[#2a2a2a] rounded-xl p-1">
          <button onClick={() => setActiveTab("labor")} className={tabBtn("labor")}>
            Crew Hours{laborLogs.length > 0 ? ` · ${laborLogs.length}` : ""}
          </button>
          <button onClick={() => setActiveTab("subs")} className={tabBtn("subs")}>
            Subcontractors{subLogs.length > 0 ? ` · ${subLogs.length}` : ""}
          </button>
        </div>
        {/* Dynamic add button */}
        {activeTab === "labor" ? (
          <div className="flex items-center gap-2">
            {laborLogs.length > 0 && (role === "owner" || can_see_financials) && (
              <span className="text-orange-500 font-bold text-sm">${Math.round(totalLaborCost).toLocaleString()}</span>
            )}
            <button onClick={openLaborPicker} className="text-gray-400 font-semibold text-sm bg-[#1A1A1A] border border-[#2a2a2a] px-3 py-2.5 rounded-xl active:scale-95 transition-transform">Saved</button>
            <button onClick={() => setShowImport(true)} className="text-gray-300 font-semibold text-sm bg-[#1A1A1A] border border-[#2a2a2a] px-3 py-2.5 rounded-xl active:scale-95 transition-transform">Import</button>
            <button
              onClick={() => { setFormName(""); setFormHours(""); setFormRate(""); setShowLaborForm((s) => !s); setLaborFormError(""); }}
              className="text-white font-semibold text-sm bg-[#1A1A1A] border border-[#2a2a2a] px-3 py-2.5 rounded-xl active:scale-95 transition-transform"
            >
              {showLaborForm ? "Cancel" : "+ Log"}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {subLogs.length > 0 && (
              <span className="text-orange-500 font-bold text-sm">{fmt$(totalSubQuoted)}</span>
            )}
            <button onClick={openSubAdd} className="text-white font-semibold text-sm bg-[#1A1A1A] border border-[#2a2a2a] px-4 py-2.5 rounded-xl active:scale-95 transition-transform">
              + Add Sub
            </button>
          </div>
        )}
      </div>

      {/* ── LABOR TAB CONTENT ─────────────────────────────────────────────── */}
      <div className={activeTab !== "labor" ? "hidden" : ""}>
        {showLaborForm && (
          <form key={formKey} onSubmit={handleLaborAdd} className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 mb-4 flex flex-col gap-3">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Log Labor</p>
            <LaborNameAutocomplete value={formName} onChange={setFormName} onSelectContact={handleSelectAutoContact}
              contacts={acContacts} onLoadContacts={loadAcContacts} contactsLoaded={acLoaded} />
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-gray-400 text-xs uppercase tracking-wider">Hours</label>
                <input type="number" inputMode="decimal" min="0" step="0.5" required placeholder="8"
                  value={formHours} onChange={(e) => setFormHours(e.target.value)}
                  className="bg-[#242424] border border-[#333333] text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500" />
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-gray-400 text-xs uppercase tracking-wider">Rate $/hr</label>
                <input type="number" inputMode="decimal" min="0" step="any" required placeholder="35"
                  value={formRate} onChange={(e) => setFormRate(e.target.value)}
                  className="bg-[#242424] border border-[#333333] text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500" />
              </div>
            </div>
            {jobTypes.length >= 2 && (
              <div className="flex flex-col gap-1">
                <label className="text-gray-400 text-xs uppercase tracking-wider">Trade <span className="text-gray-600 normal-case">(optional)</span></label>
                <select value={formTrade} onChange={(e) => setFormTrade(e.target.value)}
                  className="bg-[#242424] border border-[#333333] text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500">
                  <option value="">— None —</option>
                  {jobTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}
            {laborFormError && <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-xl px-4 py-3">{laborFormError}</p>}
            <button type="submit" disabled={laborSaving} className="bg-orange-500 text-white font-bold text-lg py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50">
              {laborSaving ? "Saving..." : "Add Labor Entry"}
            </button>
          </form>
        )}

        {laborLogs.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl py-10 flex flex-col items-center gap-3">
            <p className="text-gray-500 text-sm">No labor logged yet</p>
            <button onClick={() => setShowLaborForm(true)} className="bg-orange-500 text-white font-bold text-base px-6 py-3 rounded-xl active:scale-95">
              Log your first crew member
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {laborLogs.map((log) => {
              const lineTotal = Number(log.hours) * Number(log.rate);
              const isEditing = laborEditingId === log.id;
              if (isEditing) {
                return (
                  <form key={log.id} onSubmit={(e) => handleLaborEdit(e, log.id)}
                    className="bg-[#1A1A1A] border border-orange-500/40 rounded-xl px-4 py-4 flex flex-col gap-3">
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Edit Labor Entry</p>
                    <input name="crew_name" type="text" required defaultValue={log.crew_name}
                      className="bg-[#242424] border border-[#333333] text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500" />
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1 flex flex-col gap-1">
                        <label className="text-gray-400 text-xs uppercase tracking-wider">Hours</label>
                        <input name="hours" type="number" inputMode="decimal" min="0" step="0.5" required defaultValue={Number(log.hours)}
                          className="bg-[#242424] border border-[#333333] text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500" />
                      </div>
                      <div className="flex-1 flex flex-col gap-1">
                        <label className="text-gray-400 text-xs uppercase tracking-wider">Rate $/hr</label>
                        <input name="rate" type="number" inputMode="decimal" min="0" step="any" required defaultValue={Number(log.rate)}
                          className="bg-[#242424] border border-[#333333] text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500" />
                      </div>
                    </div>
                    {jobTypes.length >= 2 && (
                      <div className="flex flex-col gap-1">
                        <label className="text-gray-400 text-xs uppercase tracking-wider">Trade</label>
                        <select name="trade" defaultValue={log.trade ?? ""}
                          className="bg-[#242424] border border-[#333333] text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500">
                          <option value="">— None —</option>
                          {jobTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    )}
                    {laborEditError && <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-xl px-4 py-3">{laborEditError}</p>}
                    <div className="flex gap-2">
                      <button type="submit" disabled={laborSaving} className="flex-1 bg-orange-500 text-white font-bold py-4 rounded-xl active:scale-95 disabled:opacity-50">
                        {laborSaving ? "Saving..." : "Save Changes"}
                      </button>
                      <button type="button" onClick={() => { setLaborEditingId(null); setLaborEditError(""); }}
                        className="px-5 py-4 bg-[#242424] text-gray-400 font-semibold rounded-xl active:scale-95">
                        Cancel
                      </button>
                    </div>
                  </form>
                );
              }
              return (
                <div key={log.id} className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={log.crew_name} size={36} />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white font-semibold text-base">{log.crew_name}</p>
                          {log.trade && (
                            <span className="text-xs font-semibold uppercase tracking-wider text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded-full">{log.trade}</span>
                          )}
                        </div>
                        <p className="text-gray-500 text-xs mt-0.5">{formatDate(log.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setLaborEditingId(log.id); setShowLaborForm(false); setLaborEditError(""); }}
                        className="text-gray-400 text-sm px-3 py-3 rounded-xl border border-[#2a2a2a] active:scale-95">Edit</button>
                      <button onClick={() => handleLaborDelete(log.id)} className="text-red-400 text-sm px-3 py-3 rounded-xl border border-[#2a2a2a] active:scale-95">✕</button>
                    </div>
                  </div>
                  <div className={`grid gap-2 text-center ${(role === "owner" || can_see_financials) ? "grid-cols-3" : "grid-cols-1"}`}>
                    <div className="bg-[#242424] rounded-lg py-2">
                      <p className="text-gray-400 text-xs uppercase tracking-wider mb-0.5">Hours</p>
                      <p className="text-white font-semibold">{Number(log.hours)}</p>
                    </div>
                    {(role === "owner" || can_see_financials) && (
                      <>
                        <div className="bg-[#242424] rounded-lg py-2">
                          <p className="text-gray-400 text-xs uppercase tracking-wider mb-0.5">Rate</p>
                          <p className="text-white font-semibold">${Number(log.rate)}/hr</p>
                        </div>
                        <div className="bg-[#242424] rounded-lg py-2">
                          <p className="text-gray-400 text-xs uppercase tracking-wider mb-0.5">Total</p>
                          <p className="text-orange-500 font-bold">${Math.round(lineTotal).toLocaleString()}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Total hours</span>
                <span className="text-white font-semibold">{totalLaborHours.toFixed(1)} hrs</span>
              </div>
              {(role === "owner" || can_see_financials) && (
                <div className="flex justify-between text-sm border-t border-[#2a2a2a] pt-2">
                  <span className="text-gray-400">Total labor cost</span>
                  <span className="text-white font-bold text-base">${Math.round(totalLaborCost).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── SUBS TAB CONTENT ──────────────────────────────────────────────── */}
      <div className={activeTab !== "subs" ? "hidden" : ""}>
        {showSubForm && (
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 mb-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
                {subEditingId ? "Edit Subcontractor" : "Add Subcontractor"}
              </p>
              <button onClick={openSubPicker} className="text-gray-400 text-xs font-semibold border border-[#2a2a2a] px-3 py-2 rounded-xl active:scale-95">From Contacts</button>
            </div>
            <input value={subForm.company_name} onChange={(e) => setSubField("company_name", e.target.value)}
              placeholder="Company / contractor name *" className={inputCls} />
            <select value={subForm.trade} onChange={(e) => setSubField("trade", e.target.value)} className={inputCls + " appearance-none"}>
              <option value="">Trade (optional)</option>
              {TRADES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <textarea value={subForm.scope_description} onChange={(e) => setSubField("scope_description", e.target.value)}
              placeholder="Scope — what are they doing on this job?" rows={2} className={inputCls + " resize-none"} />
            <div>
              <label className="text-gray-400 text-xs uppercase tracking-wider block mb-1">Quoted Amount</label>
              <div className="flex items-center gap-2 bg-[#242424] border border-[#333] rounded-xl px-4 py-4">
                <span className="text-gray-500 text-sm">$</span>
                <input type="number" inputMode="decimal" min="0" value={subForm.quoted_amount}
                  onChange={(e) => setSubField("quoted_amount", e.target.value)} placeholder="0"
                  className="flex-1 bg-transparent text-white text-base focus:outline-none" />
              </div>
            </div>
            <button type="button"
              onClick={() => { setSubField("invoice_received", !subForm.invoice_received); if (subForm.invoice_received) setSubField("invoice_amount", ""); }}
              className={`flex items-center justify-between px-4 py-4 rounded-xl border transition-colors ${subForm.invoice_received ? "border-orange-500/40 bg-orange-500/10" : "border-[#333] bg-[#242424]"}`}>
              <span className={`text-base font-semibold ${subForm.invoice_received ? "text-orange-400" : "text-gray-300"}`}>Invoice Received</span>
              <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${subForm.invoice_received ? "bg-orange-500 justify-end" : "bg-[#3a3a3a] justify-start"}`}>
                <div className="w-5 h-5 rounded-full bg-white shadow" />
              </div>
            </button>
            {subForm.invoice_received && (
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wider block mb-1">Invoice Amount</label>
                <div className="flex items-center gap-2 bg-[#242424] border border-[#333] rounded-xl px-4 py-4">
                  <span className="text-gray-500 text-sm">$</span>
                  <input type="number" inputMode="decimal" min="0" value={subForm.invoice_amount}
                    onChange={(e) => setSubField("invoice_amount", e.target.value)} placeholder="0"
                    className="flex-1 bg-transparent text-white text-base focus:outline-none" />
                </div>
              </div>
            )}
            <button type="button" onClick={() => setSubField("paid", !subForm.paid)}
              className={`flex items-center justify-between px-4 py-4 rounded-xl border transition-colors ${subForm.paid ? "border-green-600/40 bg-green-600/10" : "border-[#333] bg-[#242424]"}`}>
              <span className={`text-base font-semibold ${subForm.paid ? "text-green-400" : "text-gray-300"}`}>Paid</span>
              <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${subForm.paid ? "bg-green-500 justify-end" : "bg-[#3a3a3a] justify-start"}`}>
                <div className="w-5 h-5 rounded-full bg-white shadow" />
              </div>
            </button>
            <textarea value={subForm.notes} onChange={(e) => setSubField("notes", e.target.value)}
              placeholder="Notes (optional)" rows={2} className={inputCls + " resize-none"} />
            {subError && <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-xl px-4 py-3">{subError}</p>}
            <div className="flex gap-2">
              <button onClick={handleSubSave} disabled={subSaving} className="flex-1 bg-orange-500 text-white font-bold py-4 rounded-xl active:scale-95 disabled:opacity-50">
                {subSaving ? "Saving…" : subEditingId ? "Save Changes" : "Add Subcontractor"}
              </button>
              <button onClick={cancelSubForm} className="px-5 py-4 bg-[#242424] text-gray-400 font-semibold rounded-xl active:scale-95">Cancel</button>
            </div>
          </div>
        )}

        {subLogs.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl py-10 text-center">
            <p className="text-gray-500 text-sm">No subcontractors on this job</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {subLogs.map((log) => {
              const badge = subStatusBadge(log);
              const displayAmt = log.invoice_received && log.invoice_amount != null ? Number(log.invoice_amount) : Number(log.quoted_amount ?? 0);
              void displayAmt;
              return (
                <div key={log.id} className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-semibold text-base">{log.company_name}</p>
                        {log.trade && <span className="text-orange-500 text-xs font-semibold bg-orange-500/10 px-2 py-0.5 rounded-full">{log.trade}</span>}
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.label}</span>
                      </div>
                      {log.scope_description && <p className="text-gray-400 text-sm mt-1 line-clamp-2">{log.scope_description}</p>}
                    </div>
                    <div className="flex gap-2 ml-3 shrink-0">
                      <button onClick={() => openSubEdit(log)} className="text-gray-400 text-sm px-3 py-3 rounded-xl border border-[#2a2a2a] active:scale-95">Edit</button>
                      <button onClick={() => setConfirmSubDeleteId(log.id)} className="text-red-400 text-sm px-3 py-3 rounded-xl border border-[#2a2a2a] active:scale-95">✕</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="bg-[#242424] rounded-lg py-2 px-3">
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-0.5">Quoted</p>
                      <p className="text-white font-semibold">{log.quoted_amount != null ? fmt$(Number(log.quoted_amount)) : "—"}</p>
                    </div>
                    <div className="bg-[#242424] rounded-lg py-2 px-3">
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-0.5">{log.invoice_received ? "Invoiced" : "Invoice"}</p>
                      <p className={`font-semibold ${log.invoice_received ? "text-orange-400" : "text-gray-600"}`}>
                        {log.invoice_received && log.invoice_amount != null ? fmt$(Number(log.invoice_amount)) : "—"}
                      </p>
                    </div>
                  </div>
                  {log.notes && <p className="text-gray-600 text-xs mt-2">{log.notes}</p>}
                </div>
              );
            })}
            {subLogs.length > 1 && (
              <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Total quoted</span>
                  <span className="text-white font-semibold">{fmt$(totalSubQuoted)}</span>
                </div>
                {totalSubInvoiced > 0 && (
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Total invoiced</span>
                    <span className="text-orange-400 font-semibold">{fmt$(totalSubInvoiced)}</span>
                  </div>
                )}
                {totalSubPaid > 0 && (
                  <div className="flex justify-between text-sm border-t border-[#2a2a2a] pt-2">
                    <span className="text-gray-400">Total paid</span>
                    <span className="text-green-400 font-bold">{fmt$(totalSubPaid)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── LABOR CONTACT PICKER OVERLAY ──────────────────────────────────── */}
      {showLaborPicker && (
        <div className="fixed inset-0 z-50 bg-[#0A0A0A] flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between px-5 pt-6 pb-4 shrink-0 border-b border-[#2a2a2a]">
            <div>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">Add from Saved</p>
              <h2 className="text-white font-bold text-xl">Select Contact or Crew</h2>
            </div>
            <button onClick={() => setShowLaborPicker(false)} className="text-gray-400 text-3xl leading-none w-11 h-11 flex items-center justify-center active:scale-95">×</button>
          </div>
          {laborPickerLoading ? (
            <div className="flex-1 flex items-center justify-center"><p className="text-gray-500 animate-pulse">Loading...</p></div>
          ) : (
            <div className="flex-1 px-5 py-5">
              {laborPickerContacts.length > 0 && (
                <>
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Contacts</p>
                  <div className="flex flex-col gap-2 mb-6">
                    {laborPickerContacts.map((c) => (
                      <button key={c.id} onClick={() => selectLaborContact(c)}
                        className="w-full flex items-center justify-between bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 active:scale-95 text-left">
                        <div>
                          <p className="text-white font-semibold text-base">{c.name}</p>
                          <div className="flex gap-2 mt-0.5">
                            {c.trade && <span className="text-orange-500 text-xs">{c.trade}</span>}
                            {c.hourly_rate !== null && <span className="text-gray-400 text-xs">${Number(c.hourly_rate)}/hr</span>}
                          </div>
                        </div>
                        <span className="text-gray-600 text-xl">→</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {laborPickerCrews.length > 0 && (
                <>
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Crews</p>
                  <div className="flex flex-col gap-2">
                    {laborPickerCrews.map((cr) => {
                      const byId = new Map(laborPickerContacts.map((c) => [c.id, c]));
                      const members = cr.crew_members.map((m) => byId.get(m.contact_id)).filter(Boolean) as Contact[];
                      const rate = members.reduce((s, m) => s + (m.hourly_rate ? Number(m.hourly_rate) : 0), 0);
                      return (
                        <button key={cr.id} onClick={() => selectLaborCrew(cr, laborPickerContacts)}
                          className="w-full flex items-center justify-between bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 active:scale-95 text-left">
                          <div>
                            <p className="text-white font-semibold text-base">{cr.name}</p>
                            <div className="flex gap-2 mt-0.5">
                              <span className="text-gray-400 text-xs">{members.length} member{members.length !== 1 ? "s" : ""}</span>
                              {rate > 0 && <span className="text-orange-500 text-xs">${rate.toLocaleString()}/hr</span>}
                            </div>
                          </div>
                          <span className="text-gray-600 text-xl">→</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              {laborPickerContacts.length === 0 && laborPickerCrews.length === 0 && (
                <div className="py-16 text-center">
                  <p className="text-gray-500 text-base">No saved contacts yet</p>
                  <p className="text-gray-600 text-sm mt-2">Go to People to add workers and crews</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── SUB CONTACT PICKER OVERLAY ────────────────────────────────────── */}
      {subPickerOpen && (
        <div className="fixed inset-0 z-50 bg-[#0A0A0A] flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between px-5 pt-6 pb-4 shrink-0 border-b border-[#2a2a2a]">
            <div>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">From Saved</p>
              <h2 className="text-white font-bold text-xl">Select Contact</h2>
            </div>
            <button onClick={() => setSubPickerOpen(false)} className="text-gray-400 text-3xl leading-none w-11 h-11 flex items-center justify-center active:scale-95">×</button>
          </div>
          {subPickerLoading ? (
            <div className="flex-1 flex items-center justify-center"><p className="text-gray-500 animate-pulse">Loading…</p></div>
          ) : subPickerContacts.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-gray-500 text-base">No trade contacts yet</p>
                <p className="text-gray-600 text-sm mt-2">Add contacts with a trade in People</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 px-5 py-5 flex flex-col gap-2">
              {subPickerContacts.map((c) => {
                const coi = subCoiMap.get(c.id);
                const coiStatus = getCOIStatus(coi?.expiration_date);
                const dotColor = coiStatus === "valid" ? "bg-green-500" : coiStatus === "expiring_soon" ? "bg-yellow-400" : coiStatus === "expired" ? "bg-red-500" : null;
                return (
                  <button key={c.id} onClick={() => selectSubContact(c)}
                    className="w-full flex items-center justify-between bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 active:scale-95 text-left">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-white font-semibold text-base">{c.name}</p>
                        {dotColor && <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} />}
                      </div>
                      <div className="flex gap-2 mt-0.5">
                        {c.trade && <span className="text-orange-500 text-xs">{c.trade}</span>}
                        {c.is_subcontractor && <span className="text-purple-400 text-xs font-semibold">Sub</span>}
                        {coiStatus === "expired" && <span className="text-red-400 text-xs font-semibold">COI Expired</span>}
                        {coiStatus === "expiring_soon" && <span className="text-yellow-400 text-xs font-semibold">COI Expiring</span>}
                      </div>
                    </div>
                    <span className="text-gray-600 text-xl">→</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── COI EXPIRED WARNING ───────────────────────────────────────────── */}
      {subCoiWarningContact && (
        <>
          <div className="fixed inset-0 z-50 bg-black/70" onClick={() => setSubCoiWarningContact(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl px-5 pt-6" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <p className="text-white font-bold text-lg leading-tight">Expired COI</p>
            </div>
            <p className="text-gray-400 text-sm mb-6">
              <span className="text-white font-semibold">{subCoiWarningContact.name}</span> has an expired certificate of insurance. Assign anyway or update their COI first in People.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setSubCoiWarningContact(null)} className="flex-1 bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold py-4 rounded-xl active:scale-95">Cancel</button>
              <button onClick={() => commitSelectSubContact(subCoiWarningContact)} className="flex-1 bg-red-600/80 text-white font-bold py-4 rounded-xl active:scale-95">Assign Anyway</button>
            </div>
          </div>
        </>
      )}

      {/* ── SUB DELETE CONFIRM ────────────────────────────────────────────── */}
      {confirmSubDeleteId && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setConfirmSubDeleteId(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl px-5 pt-6" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}>
            <p className="text-white font-bold text-lg mb-1">Remove subcontractor?</p>
            <p className="text-gray-400 text-sm mb-6">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmSubDeleteId(null)} className="flex-1 bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold py-4 rounded-xl active:scale-95">Cancel</button>
              <button onClick={handleSubDelete} disabled={subDeleting} className="flex-1 bg-red-600 text-white font-bold py-4 rounded-xl active:scale-95 disabled:opacity-50">
                {subDeleting ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── IMPORT MODAL ─────────────────────────────────────────────────── */}
      {showImport && (
        <JobImportModal
          jobId={jobId}
          mode="labor"
          onClose={() => setShowImport(false)}
          onComplete={async () => {
            const supabase = createClient();
            const { data } = await supabase.from("labor_logs").select("*").eq("job_id", jobId).order("created_at", { ascending: false });
            if (data) setLaborLogs(data as LaborLog[]);
          }}
        />
      )}
    </div>
  );
}
