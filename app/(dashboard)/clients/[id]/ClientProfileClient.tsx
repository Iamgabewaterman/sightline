"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Client, Job, Invoice, Estimate } from "@/types";
import { updateClientRecord, deleteClientRecord } from "@/app/actions/clients";
import TypeTags from "@/components/TypeTags";

type JobWithData = Job & { estimate: Estimate | null; invoice: Invoice | null };

function fmt$(n: number) {
  if (n >= 1000) return "$" + (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return "$" + Math.round(n).toLocaleString();
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

const INVOICE_STATUS: Record<string, { label: string; classes: string }> = {
  unpaid: { label: "Unpaid", classes: "bg-red-500/20 text-red-400"       },
  sent:   { label: "Sent",   classes: "bg-yellow-500/20 text-yellow-400" },
  paid:   { label: "Paid",   classes: "bg-green-500/20 text-green-400"   },
};

function invoiceIsOverdue(inv: Invoice): boolean {
  if (inv.status === "paid") return false;
  if (!inv.due_date) return false;
  return inv.due_date < new Date().toISOString().split("T")[0];
}

function daysPastDue(inv: Invoice): number {
  if (!inv.due_date) return 0;
  return Math.ceil((new Date().getTime() - new Date(inv.due_date + "T00:00:00").getTime()) / 86400000);
}

const inputCls = "w-full bg-[#1A1A1A] border border-[#2a2a2a] text-white rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-500";

export default function ClientProfileClient({
  client: initialClient,
  jobs,
  stats,
}: {
  client: Client;
  jobs: JobWithData[];
  stats: { totalQuoteValue: number; paidTotal: number; openInvoices: Invoice[]; completedCount: number };
}) {
  const router = useRouter();
  const [client, setClient] = useState(initialClient);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(client.name);
  const [company, setCompany] = useState(client.company ?? "");
  const [phone, setPhone] = useState(client.phone ?? "");
  const [email, setEmail] = useState(client.email ?? "");
  const [address, setAddress] = useState(client.address ?? "");
  const [notes, setNotes] = useState(client.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    if (!name.trim()) { setSaveError("Name is required"); return; }
    setSaving(true); setSaveError("");
    const res = await updateClientRecord(client.id, { name: name.trim(), company: company || null, phone: phone || null, email: email || null, address: address || null, notes: notes || null });
    setSaving(false);
    if (res.error) { setSaveError(res.error); return; }
    setClient((prev) => ({ ...prev, name: name.trim(), company: company || null, phone: phone || null, email: email || null, address: address || null, notes: notes || null }));
    setEditing(false);
  }

  async function handleDelete() {
    setDeleting(true);
    await deleteClientRecord(client.id);
    router.push("/clients");
  }

  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-8 pb-16">
      <div className="max-w-lg mx-auto">
        {/* Back */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/clients" className="text-gray-400 text-2xl leading-none min-w-[48px] min-h-[48px] flex items-center justify-center active:scale-95">←</Link>
          <button
            onClick={() => { setEditing(!editing); setSaveError(""); }}
            className="text-white border border-[#2a2a2a] font-semibold text-sm px-4 py-3 rounded-xl active:scale-95 transition-transform"
          >
            {editing ? "Cancel" : "Edit"}
          </button>
        </div>

        {/* Profile header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
            <span className="text-orange-400 font-black text-xl">{initials(client.name)}</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white leading-tight">{client.name}</h1>
            {client.company && <p className="text-gray-400 text-sm">{client.company}</p>}
          </div>
        </div>

        {editing ? (
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5 flex flex-col gap-3 mb-6">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name *" className={inputCls} />
            <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" className={inputCls} />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" type="tel" className={inputCls} />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className={inputCls} />
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" className={inputCls} />
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" rows={3} className={inputCls + " resize-none"} />
            {saveError && <p className="text-red-400 text-sm">{saveError}</p>}
            <button onClick={handleSave} disabled={saving} className="w-full bg-orange-500 text-white font-bold py-4 rounded-xl active:scale-95 disabled:opacity-50">
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        ) : (
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4 flex flex-col gap-2 mb-6">
            {client.phone && (
              <a href={`tel:${client.phone}`} className="flex items-center gap-3 py-1 active:opacity-70">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.01 1.18 2 2 0 012 .01h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>
                <span className="text-white text-base">{client.phone}</span>
              </a>
            )}
            {client.email && (
              <a href={`mailto:${client.email}`} className="flex items-center gap-3 py-1 active:opacity-70">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                <span className="text-white text-base">{client.email}</span>
              </a>
            )}
            {client.address && (
              <div className="flex items-start gap-3 py-1">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" className="mt-1 shrink-0"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span className="text-gray-300 text-base">{client.address}</span>
              </div>
            )}
            {client.notes && (
              <div className="pt-2 border-t border-[#2a2a2a] mt-1">
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">Notes</p>
                <p className="text-gray-300 text-sm whitespace-pre-wrap">{client.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-3 py-4 text-center">
            <p className="text-orange-500 font-black text-2xl leading-none mb-1">{jobs.length}</p>
            <p className="text-gray-500 text-xs uppercase tracking-wider">Jobs</p>
          </div>
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-3 py-4 text-center">
            <p className="text-orange-500 font-black text-xl leading-none mb-1">{fmt$(stats.totalQuoteValue)}</p>
            <p className="text-gray-500 text-xs uppercase tracking-wider">Quoted</p>
          </div>
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-3 py-4 text-center">
            <p className="text-green-400 font-black text-xl leading-none mb-1">{fmt$(stats.paidTotal)}</p>
            <p className="text-gray-500 text-xs uppercase tracking-wider">Paid</p>
          </div>
        </div>

        {/* Open invoices */}
        {stats.openInvoices.length > 0 && (
          <div className="mb-8">
            <h2 className="text-white font-bold text-lg mb-3">Open Invoices</h2>
            <div className="flex flex-col gap-2">
              {stats.openInvoices.map((inv) => {
                const job = jobs.find((j) => j.id === inv.job_id);
                const cfg = INVOICE_STATUS[inv.status];
                return (
                  <Link key={inv.id} href={`/jobs/${inv.job_id}`} className="flex items-center justify-between bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4 active:scale-[0.99]">
                    <div>
                      <p className="text-white font-semibold text-sm">{job?.name ?? "Job"}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${cfg.classes}`}>{cfg.label}</span>
                        {invoiceIsOverdue(inv) && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/40">
                            Overdue {daysPastDue(inv)}d
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-orange-400 font-bold text-base">{fmt$(Number(inv.total_amount))}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Jobs */}
        <h2 className="text-white font-bold text-lg mb-3">Jobs ({jobs.length})</h2>
        {jobs.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl py-10 text-center">
            <p className="text-gray-500 text-sm">No jobs linked to this client yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {jobs.map((job) => {
              const est = job.estimate;
              const addonsTotal = est ? (est.addons as { amount: number }[] ?? []).reduce((s, a) => s + a.amount, 0) : 0;
              const quoteTotal = est ? est.final_quote + addonsTotal : null;
              return (
                <Link key={job.id} href={`/jobs/${job.id}`} className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4 active:scale-[0.99] transition-transform block">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-white font-semibold text-base leading-tight flex-1">{job.name}</h3>
                    <div className="flex items-center gap-2 shrink-0">
                      {job.invoice && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${INVOICE_STATUS[job.invoice.status].classes}`}>
                          {INVOICE_STATUS[job.invoice.status].label}
                        </span>
                      )}
                      {quoteTotal !== null && (
                        <span className="text-orange-500 font-bold text-base">{fmt$(quoteTotal)}</span>
                      )}
                    </div>
                  </div>
                  <TypeTags types={job.types} />
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-gray-500 text-xs">{job.address}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      job.status === "active" ? "bg-orange-500/20 text-orange-400"
                      : job.status === "completed" ? "bg-green-500/20 text-green-400"
                      : "bg-[#2a2a2a] text-gray-400"
                    }`}>
                      {job.status === "on_hold" ? "On Hold" : job.status === "active" ? "Active" : "Done"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Danger zone */}
        <div className="mt-10 pt-6 border-t border-[#2a2a2a]">
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} className="text-red-400 font-semibold text-sm active:opacity-70">
              Delete Client
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-gray-400 text-sm">Delete {client.name}? Their jobs won't be deleted.</p>
              <button onClick={handleDelete} disabled={deleting} className="bg-red-600 text-white font-bold py-4 rounded-xl active:scale-95 disabled:opacity-50">
                {deleting ? "Deleting…" : "Confirm Delete"}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="text-gray-400 font-semibold py-3">Cancel</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
