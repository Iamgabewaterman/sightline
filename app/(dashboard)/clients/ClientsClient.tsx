"use client";

import { useState } from "react";
import Link from "next/link";
import { Client } from "@/types";
import { createClientRecord, deleteClientRecord } from "@/app/actions/clients";

const inputCls = "w-full bg-[#1A1A1A] border border-[#2a2a2a] text-white rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-500";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

export default function ClientsClient({ initialClients }: { initialClients: Client[] }) {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filtered = search.trim()
    ? clients.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.company ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (c.phone ?? "").includes(search)
      )
    : clients;

  function openSheet() {
    setName(""); setCompany(""); setPhone(""); setEmail(""); setAddress(""); setNotes(""); setError("");
    setSheetOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError("");
    const res = await createClientRecord({ name: name.trim(), company: company || undefined, phone: phone || undefined, email: email || undefined, address: address || undefined, notes: notes || undefined });
    setSaving(false);
    if (res.error) { setError(res.error); return; }
    setClients((prev) => [...prev, res.client!].sort((a, b) => a.name.localeCompare(b.name)));
    setSheetOpen(false);
  }

  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 pt-6 pb-8">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-bold text-white">Clients</h1>
          <button
            onClick={openSheet}
            className="bg-orange-500 text-white font-bold text-sm px-4 py-3 rounded-xl active:scale-95 transition-transform"
          >
            + Add
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients…"
            className="w-full bg-[#1A1A1A] border border-[#2a2a2a] text-white rounded-xl pl-10 pr-4 py-3.5 text-base placeholder:text-gray-600 focus:outline-none focus:border-orange-500"
          />
        </div>

        <p className="text-gray-500 text-sm mb-4">{filtered.length} client{filtered.length !== 1 ? "s" : ""}</p>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl py-14 text-center">
            <p className="text-gray-500 text-sm">
              {clients.length === 0 ? "No clients yet. Tap + Add to create your first." : "No matches."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((c) => (
              <Link
                key={c.id}
                href={`/clients/${c.id}`}
                className="flex items-center gap-4 bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4 active:scale-[0.99] transition-transform"
              >
                <div className="w-11 h-11 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                  <span className="text-orange-400 font-bold text-sm">{initials(c.name)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-base leading-tight">{c.name}</p>
                  {c.company && <p className="text-gray-400 text-sm truncate">{c.company}</p>}
                  {c.phone && <p className="text-gray-500 text-sm">{c.phone}</p>}
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Add client sheet */}
      {sheetOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setSheetOpen(false)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl flex flex-col"
            style={{ maxHeight: "90vh", paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
          >
            <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mt-3 mb-4 shrink-0" />
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest px-6 mb-4 shrink-0">New Client</p>
            <div className="flex-1 overflow-y-auto px-5 flex flex-col gap-3 pb-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name *" className={inputCls} />
              <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company (optional)" className={inputCls} />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" type="tel" className={inputCls} />
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className={inputCls} />
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" className={inputCls} />
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" rows={3} className={inputCls + " resize-none"} />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button onClick={handleSave} disabled={saving} className="w-full bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50">
                {saving ? "Saving…" : "Save Client"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
