"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { DemoJob, DemoMaterial, DemoLabor, calcDemoProfitability } from "@/app/demo/_data";

const TYPE_LABELS: Record<string, string> = {
  drywall: "Drywall", framing: "Framing", plumbing: "Plumbing", paint: "Paint",
  trim: "Trim", roofing: "Roofing", tile: "Tile", flooring: "Flooring",
  electrical: "Electrical", hvac: "HVAC", concrete: "Concrete",
  landscaping: "Landscaping", decks_patios: "Decks & Patios", fencing: "Fencing",
};

interface Props {
  job: DemoJob;
  onBack: () => void;
  onMaterialAdded: (m: DemoMaterial) => void;
  onLaborAdded: (l: DemoLabor) => void;
}

function SavedBanner({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-sm">
      <div className="bg-[#1e1e1e] border border-[#3a3a3a] rounded-xl px-4 py-3 flex items-center gap-3 shadow-xl">
        <span className="text-green-400 text-base shrink-0">✓</span>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold">Saved to demo</p>
          <p className="text-gray-400 text-xs">Sign up to keep your data permanently</p>
        </div>
        <Link href="/signup" className="shrink-0 text-orange-400 text-xs font-bold whitespace-nowrap">
          Sign up →
        </Link>
      </div>
    </div>
  );
}

export default function DemoJobDetail({ job, onBack, onMaterialAdded, onLaborAdded }: Props) {
  const [addMatOpen, setAddMatOpen] = useState(false);
  const [addLaborOpen, setAddLaborOpen] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  const [matName, setMatName] = useState("");
  const [matQty, setMatQty] = useState("");
  const [matUnit, setMatUnit] = useState("piece");
  const [matCost, setMatCost] = useState("");

  const [laborName, setLaborName] = useState("");
  const [laborHours, setLaborHours] = useState("");
  const [laborRate, setLaborRate] = useState("");

  const prof = calcDemoProfitability(job);

  const barColor =
    prof.status === "over_budget" ? "bg-red-500"
    : prof.status === "eating_margin" ? "bg-yellow-500"
    : "bg-green-500";

  const barLabel =
    prof.status === "over_budget"   ? { text: "Over budget",   color: "text-red-400" }
    : prof.status === "eating_margin" ? { text: "Eating margin", color: "text-yellow-400" }
    : { text: "On track", color: "text-green-400" };

  const completedPunch = job.punchList.filter((p) => p.completed).length;
  const totalPunch = job.punchList.length;

  function submitMaterial() {
    if (!matName.trim() || !matQty || !matCost) return;
    onMaterialAdded({
      id: `m-${Date.now()}`,
      name: matName.trim(),
      qty_ordered: parseFloat(matQty),
      qty_used: null,
      unit_cost: parseFloat(matCost),
      unit: matUnit || "piece",
    });
    setMatName(""); setMatQty(""); setMatCost(""); setMatUnit("piece");
    setAddMatOpen(false);
    setShowSaved(true);
  }

  function submitLabor() {
    if (!laborName.trim() || !laborHours || !laborRate) return;
    onLaborAdded({
      id: `l-${Date.now()}`,
      name: laborName.trim(),
      hours: parseFloat(laborHours),
      rate: parseFloat(laborRate),
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    });
    setLaborName(""); setLaborHours(""); setLaborRate("");
    setAddLaborOpen(false);
    setShowSaved(true);
  }

  return (
    <div className="pb-10">
      {/* Back */}
      <button
        onClick={onBack}
        className="text-gray-400 font-semibold text-sm px-0 py-2 mb-4 -ml-1 active:text-white transition-colors flex items-center gap-1"
      >
        ← Jobs
      </button>

      {/* Title */}
      <div className="flex items-start justify-between gap-3 mb-1">
        <h1 className="text-white font-bold text-2xl leading-tight">{job.name}</h1>
        <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full mt-1 ${
          job.status === "completed" ? "bg-green-500/15 text-green-400" : "bg-orange-500/15 text-orange-400"
        }`}>
          {job.status === "completed" ? "Completed" : "Active"}
        </span>
      </div>
      <p className="text-gray-500 text-xs mb-1">{job.job_number}</p>
      <p className="text-gray-400 text-sm mb-4">{job.address}</p>

      <div className="flex flex-wrap gap-1.5 mb-5">
        {job.types.map((t) => (
          <span key={t} className="text-xs font-semibold uppercase tracking-wider text-white bg-[#292929] px-3 py-1 rounded-full">
            {TYPE_LABELS[t] ?? t}
          </span>
        ))}
      </div>

      {/* Profitability bar */}
      <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Job Profitability</p>
          <span className={`text-xs font-bold ${barLabel.color}`}>{barLabel.text}</span>
        </div>
        <div className="h-3 bg-[#2a2a2a] rounded-full overflow-hidden mb-3">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barColor}`}
            style={{ width: `${prof.fillPct}%` }}
          />
        </div>
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-white font-bold text-xl">${prof.totalActual.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
            <p className="text-gray-500 text-xs">spent so far</p>
          </div>
          <div className="text-right">
            <p className={`font-bold text-xl ${prof.profitRemaining >= 0 ? "text-green-400" : "text-red-400"}`}>
              {prof.profitRemaining >= 0 ? "+" : "-"}${Math.abs(prof.profitRemaining).toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </p>
            <p className="text-gray-500 text-xs">{prof.profitRemaining >= 0 ? "profit remaining" : "over quote"}</p>
          </div>
        </div>
        <div className="pt-3 border-t border-[#2a2a2a] grid grid-cols-2 gap-3 text-center">
          <div>
            <p className="text-gray-500 text-xs mb-0.5">Materials</p>
            <p className="text-white font-semibold text-sm">${prof.actualMat.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-0.5">Labor</p>
            <p className="text-white font-semibold text-sm">${prof.actualLabor.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
          </div>
        </div>
      </div>

      {/* Client */}
      {job.client && (
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 mb-4">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">Client</p>
          <p className="text-white font-semibold text-base">{job.client.name}</p>
          <p className="text-gray-400 text-sm mt-0.5">{job.client.phone}</p>
          {job.client.email && <p className="text-gray-500 text-sm mt-0.5">{job.client.email}</p>}
          {job.lockbox_code && (
            <p className="text-gray-500 text-xs mt-2">
              Lockbox: <span className="text-white font-bold">{job.lockbox_code}</span>
            </p>
          )}
        </div>
      )}

      {/* Punch list */}
      <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-[#2a2a2a] flex items-center justify-between">
          <p className="text-white font-semibold text-sm">Punch List</p>
          <span className="text-gray-500 text-xs">{completedPunch}/{totalPunch} done</span>
        </div>
        {job.punchList.map((item) => (
          <div key={item.id} className="px-4 py-3 border-b border-[#1e1e1e] last:border-0 flex items-start gap-3">
            <div className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center ${
              item.completed ? "bg-green-500 border-green-500" : "border-[#3a3a3a]"
            }`}>
              {item.completed && <span className="text-white text-xs leading-none">✓</span>}
            </div>
            <p className={`text-sm leading-snug ${item.completed ? "text-gray-500 line-through" : "text-gray-200"}`}>
              {item.description}
            </p>
          </div>
        ))}
      </div>

      {/* Materials */}
      <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-[#2a2a2a] flex items-center justify-between">
          <p className="text-white font-semibold text-sm">Materials</p>
          <span className="text-gray-500 text-xs">{job.materials.length} items</span>
        </div>
        {job.materials.map((m) => {
          const qty = m.qty_used ?? m.qty_ordered;
          const total = m.unit_cost ? qty * m.unit_cost : null;
          return (
            <div key={m.id} className="px-4 py-3 border-b border-[#1e1e1e] last:border-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-gray-200 text-sm font-semibold flex-1 leading-snug">{m.name}</p>
                {total !== null && (
                  <p className="text-white font-bold text-sm shrink-0">${total.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
                )}
              </div>
              <p className="text-gray-500 text-xs mt-0.5">
                {qty} {m.unit}{m.unit_cost ? ` × $${m.unit_cost}` : ""}
              </p>
            </div>
          );
        })}
        <div className="px-4 py-3 border-t border-[#2a2a2a]">
          <button
            onClick={() => setAddMatOpen(true)}
            className="w-full bg-[#242424] border border-[#3a3a3a] text-orange-400 font-bold text-sm py-3 rounded-xl active:scale-95 transition-transform"
          >
            + Add Material
          </button>
        </div>
      </div>

      {/* Labor */}
      <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-[#2a2a2a] flex items-center justify-between">
          <p className="text-white font-semibold text-sm">Labor</p>
          <span className="text-gray-500 text-xs">${prof.actualLabor.toLocaleString("en-US", { maximumFractionDigits: 0 })} logged</span>
        </div>
        {job.labor.map((l) => (
          <div key={l.id} className="px-4 py-3 border-b border-[#1e1e1e] last:border-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-gray-200 text-sm font-semibold">{l.name}</p>
              <p className="text-white font-bold text-sm shrink-0">
                ${(l.hours * l.rate).toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </p>
            </div>
            <p className="text-gray-500 text-xs mt-0.5">{l.hours} hrs × ${l.rate}/hr · {l.date}</p>
          </div>
        ))}
        <div className="px-4 py-3 border-t border-[#2a2a2a]">
          <button
            onClick={() => setAddLaborOpen(true)}
            className="w-full bg-[#242424] border border-[#3a3a3a] text-orange-400 font-bold text-sm py-3 rounded-xl active:scale-95 transition-transform"
          >
            + Log Labor
          </button>
        </div>
      </div>

      {/* Photos */}
      {job.photos.length > 0 && (
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-[#2a2a2a]">
            <p className="text-white font-semibold text-sm">Photos ({job.photos.length})</p>
          </div>
          {job.photos.map((p) => (
            <div key={p.id} className="px-4 py-3 border-b border-[#1e1e1e] last:border-0 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                p.category === "after" ? "bg-green-500/20" :
                p.category === "before" ? "bg-gray-500/20" : "bg-orange-500/20"
              }`}>
                <span className={`text-xs font-bold uppercase ${
                  p.category === "after" ? "text-green-400" :
                  p.category === "before" ? "text-gray-400" : "text-orange-400"
                }`}>
                  {p.category.slice(0, 1).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-200 text-sm leading-snug">{p.label}</p>
                <span className={`text-xs font-semibold ${
                  p.category === "after" ? "text-green-400" :
                  p.category === "before" ? "text-gray-500" : "text-orange-400"
                }`}>
                  {p.category.charAt(0).toUpperCase() + p.category.slice(1)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Invoice */}
      {job.invoice && (
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Invoice</p>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              job.invoice.status === "paid"
                ? "bg-green-500/15 text-green-400"
                : job.invoice.status === "sent"
                ? "bg-blue-500/15 text-blue-400"
                : "bg-gray-500/15 text-gray-400"
            }`}>
              {job.invoice.status.charAt(0).toUpperCase() + job.invoice.status.slice(1)}
            </span>
          </div>
          <p className="text-white font-bold text-2xl">${job.invoice.amount.toLocaleString()}</p>
          <p className="text-gray-500 text-xs mt-1">{job.invoice.number} · Due {job.invoice.due_date}</p>
          {job.invoice.paid_at && (
            <p className="text-green-400 text-xs mt-0.5">Paid {job.invoice.paid_at}</p>
          )}
        </div>
      )}

      {/* Portal preview */}
      <button
        onClick={() => setPortalOpen(true)}
        className="w-full bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold text-sm py-4 rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-2 mb-4"
      >
        <span>🔗</span> Preview Client Portal
      </button>

      {/* Notes */}
      {job.notes && (
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 mb-4">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">Notes</p>
          <p className="text-gray-300 text-sm leading-relaxed">{job.notes}</p>
        </div>
      )}

      {/* ── Add Material sheet ──────────────────────────────────────────── */}
      {addMatOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-end justify-center"
          onClick={() => setAddMatOpen(false)}
        >
          <div
            className="bg-[#141414] border border-[#2a2a2a] rounded-t-2xl w-full max-w-lg px-5 py-6"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mb-5" />
            <p className="text-white font-bold text-lg mb-4">Add Material</p>
            <div className="flex flex-col gap-3">
              <input
                className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-orange-500"
                placeholder="Material name (e.g. 2×4×8 Framing Studs)"
                value={matName}
                onChange={(e) => setMatName(e.target.value)}
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-orange-500"
                  placeholder="Qty"
                  type="number"
                  value={matQty}
                  onChange={(e) => setMatQty(e.target.value)}
                />
                <input
                  className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-orange-500"
                  placeholder="Unit"
                  value={matUnit}
                  onChange={(e) => setMatUnit(e.target.value)}
                />
                <input
                  className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-orange-500"
                  placeholder="$/unit"
                  type="number"
                  value={matCost}
                  onChange={(e) => setMatCost(e.target.value)}
                />
              </div>
              <button
                onClick={submitMaterial}
                className="w-full bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform mt-1"
              >
                Add Material
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Log Labor sheet ─────────────────────────────────────────────── */}
      {addLaborOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-end justify-center"
          onClick={() => setAddLaborOpen(false)}
        >
          <div
            className="bg-[#141414] border border-[#2a2a2a] rounded-t-2xl w-full max-w-lg px-5 py-6"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mb-5" />
            <p className="text-white font-bold text-lg mb-4">Log Labor</p>
            <div className="flex flex-col gap-3">
              <input
                className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-orange-500"
                placeholder="Crew member name"
                value={laborName}
                onChange={(e) => setLaborName(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-orange-500"
                  placeholder="Hours"
                  type="number"
                  value={laborHours}
                  onChange={(e) => setLaborHours(e.target.value)}
                />
                <input
                  className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-orange-500"
                  placeholder="Rate ($/hr)"
                  type="number"
                  value={laborRate}
                  onChange={(e) => setLaborRate(e.target.value)}
                />
              </div>
              <button
                onClick={submitLabor}
                className="w-full bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform mt-1"
              >
                Log Labor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Client portal preview ───────────────────────────────────────── */}
      {portalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center"
          onClick={() => setPortalOpen(false)}
        >
          <div
            className="bg-[#141414] border border-[#2a2a2a] rounded-t-2xl w-full max-w-lg px-5 py-6 max-h-[85vh] overflow-y-auto"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mb-5" />
            <p className="text-orange-400 text-xs font-bold uppercase tracking-widest mb-1">Client View Preview</p>
            <p className="text-white font-bold text-xl mb-5">What your client sees</p>

            <div className="bg-[#0F0F0F] border border-[#2a2a2a] rounded-2xl overflow-hidden mb-4">
              <div className="bg-orange-500/10 border-b border-[#2a2a2a] px-4 py-4">
                <p className="text-orange-400 font-bold text-xs uppercase tracking-widest mb-1">Pacific Northwest Contracting</p>
                <p className="text-white font-bold text-lg leading-snug">{job.name}</p>
                <p className="text-gray-400 text-xs mt-0.5">{job.address}</p>
              </div>

              <div className="px-4 py-4 border-b border-[#2a2a2a]">
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">Project Progress</p>
                <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden mb-1">
                  <div
                    className="h-full bg-orange-500 rounded-full transition-all"
                    style={{ width: `${Math.round((completedPunch / totalPunch) * 100)}%` }}
                  />
                </div>
                <p className="text-gray-400 text-xs">{completedPunch} of {totalPunch} tasks complete</p>
              </div>

              {job.invoice && (
                <div className="px-4 py-4 border-b border-[#2a2a2a]">
                  <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">Invoice</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-bold text-2xl">${job.invoice.amount.toLocaleString()}</p>
                      <p className="text-gray-500 text-xs mt-0.5">Due {job.invoice.due_date}</p>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                      job.invoice.status === "paid"
                        ? "bg-green-500/15 text-green-400"
                        : "bg-orange-500 text-white"
                    }`}>
                      {job.invoice.status === "paid" ? "Paid" : "Pay Now"}
                    </span>
                  </div>
                </div>
              )}

              {job.photos.length > 0 && (
                <div className="px-4 py-4">
                  <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">Progress Photos</p>
                  <div className="flex gap-2">
                    {job.photos.slice(0, 3).map((p) => (
                      <div key={p.id} className="flex-1 aspect-square bg-[#2a2a2a] rounded-lg flex items-center justify-center">
                        <span className="text-gray-600 text-xs text-center px-1 leading-tight capitalize">{p.category}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <p className="text-gray-500 text-xs text-center mb-4">
              Clients get a private link — no login required
            </p>
            <Link
              href="/signup"
              className="block w-full bg-orange-500 text-white font-bold text-base py-4 rounded-xl text-center active:scale-95 transition-transform"
            >
              Set Up Your Portal →
            </Link>
          </div>
        </div>
      )}

      {showSaved && <SavedBanner onDismiss={() => setShowSaved(false)} />}
    </div>
  );
}
