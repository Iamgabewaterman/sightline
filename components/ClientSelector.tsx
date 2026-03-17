"use client";

import { useState, useEffect } from "react";
import { Client } from "@/types";
import { createClient as supabaseClient } from "@/lib/supabase/client";
import { createClientRecord } from "@/app/actions/clients";

interface Props {
  selectedClientId: string | null;
  onChange: (clientId: string | null, clientName: string | null) => void;
}

export default function ClientSelector({ selectedClientId, onChange }: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(null);

  // Creating new client inline
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    const sb = supabaseClient();
    sb.from("clients")
      .select("*")
      .order("name", { ascending: true })
      .then(({ data }) => setClients((data as Client[]) ?? []));
  }, []);

  // Resolve selected name on mount
  useEffect(() => {
    if (selectedClientId && clients.length > 0) {
      const c = clients.find((x) => x.id === selectedClientId);
      if (c) setSelectedName(c.name);
    }
  }, [selectedClientId, clients]);

  const filtered = search.trim()
    ? clients.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.company ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : clients;

  function selectClient(c: Client) {
    onChange(c.id, c.name);
    setSelectedName(c.name);
    setSheetOpen(false);
    setSearch("");
  }

  function clearClient() {
    onChange(null, null);
    setSelectedName(null);
  }

  async function handleCreateNew() {
    if (!newName.trim()) { setCreateError("Name is required"); return; }
    setSaving(true);
    setCreateError("");
    const res = await createClientRecord({
      name: newName.trim(),
      company: newCompany || undefined,
      phone: newPhone || undefined,
      email: newEmail || undefined,
    });
    setSaving(false);
    if (res.error) { setCreateError(res.error); return; }
    const c = res.client!;
    setClients((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)));
    selectClient(c);
    setCreating(false);
    setNewName(""); setNewCompany(""); setNewPhone(""); setNewEmail("");
  }

  return (
    <>
      {/* Trigger */}
      <div className="flex flex-col gap-2">
        <label className="text-gray-400 text-sm font-medium uppercase tracking-wider">Client <span className="text-gray-500 normal-case">(optional)</span></label>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex items-center justify-between bg-[#1A1A1A] border border-[#2a2a2a] text-white rounded-xl px-4 py-4 text-base active:scale-95 transition-transform"
        >
          <span className={selectedName ? "text-white" : "text-gray-600"}>
            {selectedName ?? "Select or add a client…"}
          </span>
          <div className="flex items-center gap-2">
            {selectedName && (
              <span
                onClick={(e) => { e.stopPropagation(); clearClient(); }}
                className="text-gray-500 text-xl leading-none w-8 h-8 flex items-center justify-center"
              >×</span>
            )}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
          </div>
        </button>
      </div>

      {/* Sheet */}
      {sheetOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => { setSheetOpen(false); setCreating(false); }} />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl flex flex-col"
            style={{ maxHeight: "80vh", paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
          >
            <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mt-3 mb-4 shrink-0" />
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest px-6 mb-3 shrink-0">Select Client</p>

            {!creating ? (
              <>
                {/* Search */}
                <div className="px-4 mb-3 shrink-0">
                  <input
                    autoFocus
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search clients…"
                    className="w-full bg-[#1A1A1A] border border-[#2a2a2a] text-white rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-500"
                  />
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto px-4 flex flex-col gap-2 pb-2">
                  {filtered.length === 0 && search.trim() && (
                    <p className="text-gray-500 text-sm text-center py-4">No matches for "{search}"</p>
                  )}
                  {filtered.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectClient(c)}
                      className={`flex items-center justify-between bg-[#1A1A1A] border rounded-xl px-4 py-3.5 text-left active:scale-95 transition-transform ${
                        c.id === selectedClientId ? "border-orange-500" : "border-[#2a2a2a]"
                      }`}
                    >
                      <div>
                        <p className="text-white font-semibold text-sm">{c.name}</p>
                        {c.company && <p className="text-gray-500 text-xs">{c.company}</p>}
                      </div>
                      {c.id === selectedClientId && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      )}
                    </button>
                  ))}

                  {/* Create new */}
                  <button
                    type="button"
                    onClick={() => { setCreating(true); setNewName(search); }}
                    className="flex items-center gap-3 bg-[#1A1A1A] border border-dashed border-orange-500/40 rounded-xl px-4 py-3.5 text-orange-400 font-semibold text-sm active:scale-95 transition-transform mt-1"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Create New Client
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 overflow-y-auto px-4 flex flex-col gap-3 pb-2">
                <p className="text-white font-bold text-base mb-1">New Client</p>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name *" className="bg-[#1A1A1A] border border-[#2a2a2a] text-white rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-500" />
                <input value={newCompany} onChange={(e) => setNewCompany(e.target.value)} placeholder="Company (optional)" className="bg-[#1A1A1A] border border-[#2a2a2a] text-white rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-500" />
                <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Phone" type="tel" className="bg-[#1A1A1A] border border-[#2a2a2a] text-white rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-500" />
                <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Email" type="email" className="bg-[#1A1A1A] border border-[#2a2a2a] text-white rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-500" />
                {createError && <p className="text-red-400 text-sm">{createError}</p>}
                <button onClick={handleCreateNew} disabled={saving} className="w-full bg-orange-500 text-white font-bold py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50">
                  {saving ? "Saving…" : "Save & Select"}
                </button>
                <button type="button" onClick={() => setCreating(false)} className="w-full text-gray-400 font-semibold py-3">← Back to list</button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
