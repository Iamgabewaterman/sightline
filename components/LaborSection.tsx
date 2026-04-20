"use client";

import { useState, useEffect, useMemo } from "react";
import { addLaborLog, updateLaborLog, deleteLaborLog } from "@/app/actions/labor";
import { LaborLog, Contact, CrewWithMembers } from "@/types";
import { enqueue } from "@/hooks/useOfflineQueue";
import { useJobCost } from "@/components/JobCostContext";
import { createClient } from "@/lib/supabase/client";
import { useRole } from "@/hooks/useRole";
import Avatar from "@/components/Avatar";
import JobImportModal from "@/components/JobImportModal";

// ─── LaborNameAutocomplete ────────────────────────────────────────────────────

function LaborNameAutocomplete({
  value,
  onChange,
  onSelectContact,
  contacts,
  onLoadContacts,
  contactsLoaded,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelectContact: (c: Contact) => void;
  contacts: Contact[];
  onLoadContacts: () => void;
  contactsLoaded: boolean;
}) {
  const [open, setOpen] = useState(false);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (q.length < 1) return [];
    return contacts.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [value, contacts]);

  function handleFocus() {
    setOpen(true);
    if (!contactsLoaded) onLoadContacts();
  }

  function handleBlur() {
    setTimeout(() => setOpen(false), 150);
  }

  const showDropdown = open && suggestions.length > 0;

  return (
    <div className="relative">
      <input
        type="text"
        required
        autoComplete="off"
        placeholder="Crew name (e.g. Mike, Sub crew, You)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        autoCapitalize="words"
        autoCorrect="on"
        className="w-full bg-[#242424] border border-[#333333] text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500"
      />
      {showDropdown && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl overflow-hidden z-40 shadow-xl">
          {suggestions.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={() => { onSelectContact(c); setOpen(false); }}
              className="w-full text-left px-4 py-3 text-white text-base active:bg-[#242424] transition-colors flex items-center justify-between"
            >
              <span>{c.name}</span>
              <span className="text-gray-500 text-sm">
                {c.trade ? `${c.trade}` : ""}
                {c.trade && c.hourly_rate !== null ? " · " : ""}
                {c.hourly_rate !== null ? `$${Number(c.hourly_rate)}/hr` : ""}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function LaborSection({
  jobId,
  initialLogs,
  jobTypes = [],
}: {
  jobId: string;
  initialLogs: LaborLog[];
  jobTypes?: string[];
}) {
  const { role, can_see_financials } = useRole();
  const [logs, setLogs] = useState<LaborLog[]>(initialLogs);
  const { setActualLaborCost } = useJobCost();

  useEffect(() => {
    const cost = logs.reduce((s, l) => s + Number(l.hours) * Number(l.rate), 0);
    setActualLaborCost(cost);
  }, [logs, setActualLaborCost]);

  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editError, setEditError] = useState("");

  // Controlled form fields for pre-fill support
  const [formName, setFormName] = useState("");
  const [formHours, setFormHours] = useState("");
  const [formRate, setFormRate] = useState("");
  const [formTrade, setFormTrade] = useState("");
  const [formKey, setFormKey] = useState(0);

  // Inline autocomplete contacts
  const [acContacts, setAcContacts] = useState<Contact[]>([]);
  const [acLoaded, setAcLoaded] = useState(false);

  async function loadAcContacts() {
    if (acLoaded) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("contacts")
      .select("id, name, hourly_rate, trade")
      .order("name")
      .returns<Contact[]>();
    setAcContacts(data ?? []);
    setAcLoaded(true);
  }

  async function handleSelectAutoContact(contact: Contact) {
    setFormName(contact.name);
    if (contact.hourly_rate !== null) {
      setFormRate(String(contact.hourly_rate));
    } else {
      // Fall back to most recently used rate for this person from labor_logs
      const supabase = createClient();
      const { data } = await supabase
        .from("labor_logs")
        .select("rate")
        .eq("crew_name", contact.name)
        .order("created_at", { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        setFormRate(String(data[0].rate));
      }
    }
  }

  // Saved contacts picker
  const [showPicker, setShowPicker] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerContacts, setPickerContacts] = useState<Contact[]>([]);
  const [pickerCrews, setPickerCrews] = useState<CrewWithMembers[]>([]);

  async function openPicker() {
    setShowPicker(true);
    setPickerLoading(true);
    const supabase = createClient();
    const [{ data: contacts }, { data: crews }] = await Promise.all([
      supabase
        .from("contacts")
        .select("*")
        .order("name")
        .returns<Contact[]>(),
      supabase
        .from("crews")
        .select("*, crew_members(contact_id)")
        .order("name")
        .returns<CrewWithMembers[]>(),
    ]);
    setPickerContacts(contacts ?? []);
    setPickerCrews(crews ?? []);
    setPickerLoading(false);
    // Share loaded contacts with autocomplete too
    if (!acLoaded) {
      setAcContacts(contacts ?? []);
      setAcLoaded(true);
    }
  }

  function selectContact(contact: Contact) {
    setFormName(contact.name);
    setFormRate(contact.hourly_rate !== null ? String(contact.hourly_rate) : "");
    setShowPicker(false);
    setShowForm(true);
  }

  function selectCrew(crew: CrewWithMembers, contacts: Contact[]) {
    const contactById = new Map(contacts.map((c) => [c.id, c]));
    const members = crew.crew_members
      .map((m) => contactById.get(m.contact_id))
      .filter(Boolean) as Contact[];
    const combinedRate = members.reduce(
      (s, m) => s + (m.hourly_rate ? Number(m.hourly_rate) : 0),
      0
    );
    setFormName(crew.name);
    setFormRate(combinedRate > 0 ? String(combinedRate) : "");
    setShowPicker(false);
    setShowForm(true);
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    if (!navigator.onLine) {
      enqueue({
        type: "add_labor",
        payload: { jobId, crew_name: formName, hours: formHours, rate: formRate },
      });
      // Optimistic local entry so the user sees it immediately
      const optimistic: LaborLog = {
        id: `offline-${Date.now()}`,
        job_id: jobId,
        crew_name: formName,
        hours: formHours as unknown as number,
        rate: formRate as unknown as number,
        category: "labor",
        trade: formTrade || null,
        created_at: new Date().toISOString(),
      };
      setLogs((prev) => [optimistic, ...prev]);
      setFormName("");
      setFormHours("");
      setFormRate("");
      setFormKey((k) => k + 1);
      setShowForm(false);
      setSaving(false);
      return;
    }

    const fd = new FormData();
    fd.set("crew_name", formName);
    fd.set("hours", formHours);
    fd.set("rate", formRate);
    if (formTrade) fd.set("trade", formTrade);

    const result = await addLaborLog(jobId, fd);

    if (result.error) {
      setFormError(result.error);
    } else if (result.log) {
      setLogs((prev) => [result.log!, ...prev]);
      setFormName("");
      setFormHours("");
      setFormRate("");
      setFormTrade("");
      setFormKey((k) => k + 1);
      setShowForm(false);
    }
    setSaving(false);
  }

  async function handleEdit(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    setSaving(true);
    setEditError("");

    const fd = new FormData(e.currentTarget);
    const result = await updateLaborLog(id, fd);

    if (result.error) {
      setEditError(result.error);
    } else if (result.log) {
      setLogs((prev) => prev.map((l) => (l.id === id ? result.log! : l)));
      setEditingId(null);
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this labor entry?")) return;
    await deleteLaborLog(id);
    setLogs((prev) => prev.filter((l) => l.id !== id));
  }

  const totalHours = logs.reduce((s, l) => s + Number(l.hours), 0);
  const totalCost = logs.reduce(
    (s, l) => s + Number(l.hours) * Number(l.rate),
    0
  );

  const inputClass =
    "bg-[#242424] border border-[#333333] text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500";

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-bold text-xl">Labor</h2>
        <div className="flex items-center gap-2">
          {logs.length > 0 && (role === "owner" || can_see_financials) && (
            <span className="text-orange-500 font-bold text-base">
              ${Math.round(totalCost).toLocaleString()}
            </span>
          )}
          <button
            onClick={openPicker}
            className="text-gray-400 font-semibold text-sm bg-[#1A1A1A] border border-[#2a2a2a] px-3 py-3 rounded-xl active:scale-95 transition-transform"
          >
            Saved
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="text-gray-300 font-semibold text-sm bg-[#1A1A1A] border border-[#2a2a2a] px-4 py-3 rounded-xl active:scale-95 transition-transform"
          >
            Import
          </button>
          <button
            onClick={() => {
              setFormName("");
              setFormHours("");
              setFormRate("");
              setShowForm((s) => !s);
              setFormError("");
            }}
            className="text-white font-semibold text-sm bg-[#1A1A1A] border border-[#2a2a2a] px-4 py-3 rounded-xl active:scale-95 transition-transform"
          >
            {showForm ? "Cancel" : "+ Log"}
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <form
          key={formKey}
          onSubmit={handleAdd}
          className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 mb-4 flex flex-col gap-3"
        >
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
            Log Labor
          </p>
          <LaborNameAutocomplete
            value={formName}
            onChange={setFormName}
            onSelectContact={handleSelectAutoContact}
            contacts={acContacts}
            onLoadContacts={loadAcContacts}
            contactsLoaded={acLoaded}
          />
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-gray-400 text-xs uppercase tracking-wider">Hours</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.5"
                required
                placeholder="8"
                value={formHours}
                onChange={(e) => setFormHours(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-gray-400 text-xs uppercase tracking-wider">Rate $/hr</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                required
                placeholder="35"
                value={formRate}
                onChange={(e) => setFormRate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          {jobTypes.length >= 2 && (
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs uppercase tracking-wider">
                Trade <span className="text-gray-600 normal-case">(optional)</span>
              </label>
              <select
                value={formTrade}
                onChange={(e) => setFormTrade(e.target.value)}
                className={inputClass}
              >
                <option value="">— None —</option>
                {jobTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          )}
          {formError && (
            <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-xl px-4 py-3">
              {formError}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="bg-orange-500 text-white font-bold text-lg py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add Labor Entry"}
          </button>
        </form>
      )}

      {/* Log list */}
      {logs.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl py-10 flex flex-col items-center gap-3">
          <p className="text-gray-500 text-sm">No labor logged yet</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-orange-500 text-white font-bold text-base px-6 py-3 rounded-xl active:scale-95 transition-transform"
          >
            Log your first crew member
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {logs.map((log) => {
            const lineTotal = Number(log.hours) * Number(log.rate);
            const isEditing = editingId === log.id;

            if (isEditing) {
              return (
                <form
                  key={log.id}
                  onSubmit={(e) => handleEdit(e, log.id)}
                  className="bg-[#1A1A1A] border border-orange-500/40 rounded-xl px-4 py-4 flex flex-col gap-3"
                >
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
                    Edit Labor Entry
                  </p>
                  <input
                    name="crew_name"
                    type="text"
                    required
                    defaultValue={log.crew_name}
                    className={inputClass}
                  />
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 flex flex-col gap-1">
                      <label className="text-gray-400 text-xs uppercase tracking-wider">Hours</label>
                      <input
                        name="hours"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.5"
                        required
                        defaultValue={Number(log.hours)}
                        className={inputClass}
                      />
                    </div>
                    <div className="flex-1 flex flex-col gap-1">
                      <label className="text-gray-400 text-xs uppercase tracking-wider">Rate $/hr</label>
                      <input
                        name="rate"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        required
                        defaultValue={Number(log.rate)}
                        className={inputClass}
                      />
                    </div>
                  </div>
                  {jobTypes.length >= 2 && (
                    <div className="flex flex-col gap-1">
                      <label className="text-gray-400 text-xs uppercase tracking-wider">Trade</label>
                      <select
                        name="trade"
                        defaultValue={log.trade ?? ""}
                        className={inputClass}
                      >
                        <option value="">— None —</option>
                        {jobTypes.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {editError && (
                    <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-xl px-4 py-3">
                      {editError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 bg-orange-500 text-white font-bold py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditingId(null); setEditError(""); }}
                      className="px-5 py-4 bg-[#242424] text-gray-400 font-semibold rounded-xl active:scale-95 transition-transform"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              );
            }

            return (
              <div
                key={log.id}
                className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={log.crew_name} size={36} />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-semibold text-base">{log.crew_name}</p>
                        {log.trade && (
                          <span className="text-xs font-semibold uppercase tracking-wider text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded-full">
                            {log.trade}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 text-xs mt-0.5">{formatDate(log.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditingId(log.id); setShowForm(false); setEditError(""); }}
                      className="text-gray-400 text-sm px-3 py-3 rounded-xl border border-[#2a2a2a] active:scale-95 transition-transform"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(log.id)}
                      className="text-red-400 text-sm px-3 py-3 rounded-xl border border-[#2a2a2a] active:scale-95 transition-transform"
                    >
                      ✕
                    </button>
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
                        <p className="text-orange-500 font-bold">
                          ${Math.round(lineTotal).toLocaleString()}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* Summary */}
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Total hours</span>
              <span className="text-white font-semibold">{totalHours.toFixed(1)} hrs</span>
            </div>
            {(role === "owner" || can_see_financials) && (
              <div className="flex justify-between text-sm border-t border-[#2a2a2a] pt-2">
                <span className="text-gray-400">Total labor cost</span>
                <span className="text-white font-bold text-base">
                  ${Math.round(totalCost).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SAVED CONTACTS PICKER OVERLAY ── */}
      {showPicker && (
        <div className="fixed inset-0 z-50 bg-[#0A0A0A] flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between px-5 pt-6 pb-4 shrink-0 border-b border-[#2a2a2a]">
            <div>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">
                Add from Saved
              </p>
              <h2 className="text-white font-bold text-xl">Select Contact or Crew</h2>
            </div>
            <button
              onClick={() => setShowPicker(false)}
              className="text-gray-400 text-3xl leading-none w-11 h-11 flex items-center justify-center active:scale-95"
            >
              ×
            </button>
          </div>

          {pickerLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-500 animate-pulse">Loading...</p>
            </div>
          ) : (
            <div className="flex-1 px-5 py-5">
              {/* Contacts */}
              {pickerContacts.length > 0 && (
                <>
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">
                    Contacts
                  </p>
                  <div className="flex flex-col gap-2 mb-6">
                    {pickerContacts.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => selectContact(c)}
                        className="w-full flex items-center justify-between bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 active:scale-95 transition-transform text-left"
                      >
                        <div>
                          <p className="text-white font-semibold text-base">{c.name}</p>
                          <div className="flex gap-2 mt-0.5">
                            {c.trade && (
                              <span className="text-orange-500 text-xs">{c.trade}</span>
                            )}
                            {c.hourly_rate !== null && (
                              <span className="text-gray-400 text-xs">
                                ${Number(c.hourly_rate)}/hr
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-gray-600 text-xl">→</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Crews */}
              {pickerCrews.length > 0 && (
                <>
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">
                    Crews
                  </p>
                  <div className="flex flex-col gap-2">
                    {pickerCrews.map((cr) => {
                      const contactById = new Map(pickerContacts.map((c) => [c.id, c]));
                      const members = cr.crew_members
                        .map((m) => contactById.get(m.contact_id))
                        .filter(Boolean) as Contact[];
                      const combinedRate = members.reduce(
                        (s, m) => s + (m.hourly_rate ? Number(m.hourly_rate) : 0),
                        0
                      );
                      return (
                        <button
                          key={cr.id}
                          onClick={() => selectCrew(cr, pickerContacts)}
                          className="w-full flex items-center justify-between bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 active:scale-95 transition-transform text-left"
                        >
                          <div>
                            <p className="text-white font-semibold text-base">{cr.name}</p>
                            <div className="flex gap-2 mt-0.5">
                              <span className="text-gray-400 text-xs">
                                {members.length} member{members.length !== 1 ? "s" : ""}
                              </span>
                              {combinedRate > 0 && (
                                <span className="text-orange-500 text-xs">
                                  ${combinedRate.toLocaleString()}/hr
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-gray-600 text-xl">→</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {pickerContacts.length === 0 && pickerCrews.length === 0 && (
                <div className="py-16 text-center">
                  <p className="text-gray-500 text-base">No saved contacts yet</p>
                  <p className="text-gray-600 text-sm mt-2">
                    Go to People to add workers and crews
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showImport && (
        <JobImportModal
          jobId={jobId}
          mode="labor"
          onClose={() => setShowImport(false)}
          onComplete={async () => {
            const supabase = createClient();
            const { data } = await supabase
              .from("labor_logs")
              .select("*")
              .eq("job_id", jobId)
              .order("created_at", { ascending: false });
            if (data) setLogs(data as LaborLog[]);
          }}
        />
      )}
    </div>
  );
}
