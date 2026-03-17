"use client";

import { useState } from "react";
import { ChangeOrder } from "@/types";
import { addChangeOrder, deleteChangeOrder } from "@/app/actions/change-orders";
import { useJobCost } from "./JobCostContext";

function fmtAmt(n: number) {
  const sign = n >= 0 ? "+" : "−";
  return sign + "$" + Math.abs(Math.round(n)).toLocaleString();
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ChangeOrdersSection({ jobId }: { jobId: string }) {
  const { changeOrders, setChangeOrders } = useJobCost();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function openSheet() {
    setDescription("");
    setAmount("");
    setError("");
    setSheetOpen(true);
  }

  async function handleAdd() {
    const amtNum = parseFloat(amount);
    if (!description.trim()) return setError("Description is required");
    if (isNaN(amtNum)) return setError("Enter a valid amount");
    setSaving(true);
    setError("");
    const res = await addChangeOrder(jobId, description.trim(), amtNum);
    setSaving(false);
    if (res.error) { setError(res.error); return; }
    setChangeOrders([res.order!, ...changeOrders]);
    setSheetOpen(false);
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    await deleteChangeOrder(id);
    setChangeOrders(changeOrders.filter((o) => o.id !== id));
    setConfirmDeleteId(null);
    setDeleting(false);
  }

  const total = changeOrders.reduce((s, o) => s + Number(o.amount), 0);

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-white font-bold text-lg">Change Orders</h2>
          {changeOrders.length > 0 && (
            <span className={`text-sm font-bold ${total >= 0 ? "text-orange-400" : "text-red-400"}`}>
              {fmtAmt(total)}
            </span>
          )}
        </div>
        <button
          onClick={openSheet}
          className="flex items-center gap-1.5 text-orange-400 font-semibold text-sm active:opacity-70 min-h-[44px] px-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add
        </button>
      </div>

      {changeOrders.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl py-10 text-center">
          <p className="text-gray-500 text-sm">No change orders. Tap Add to document a scope change.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {changeOrders.map((order) => (
            <div key={order.id} className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm leading-snug">{order.description}</p>
                  <p className="text-gray-500 text-xs mt-1">{fmtDate(order.created_at)}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`font-bold text-base ${Number(order.amount) >= 0 ? "text-orange-400" : "text-red-400"}`}>
                    {fmtAmt(Number(order.amount))}
                  </span>
                  <button
                    onClick={() => setConfirmDeleteId(order.id)}
                    className="text-gray-600 active:text-red-400 min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2"
                    aria-label="Delete"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add sheet ── */}
      {sheetOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setSheetOpen(false)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
          >
            <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mt-3 mb-5" />
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest px-6 mb-4">New Change Order</p>
            <div className="flex flex-col px-5 gap-4">
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-1.5">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Added recessed lighting in hallway"
                  rows={3}
                  className="w-full bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-orange-500 resize-none"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-1.5">
                  Amount <span className="text-gray-600 font-normal normal-case">(negative for credits)</span>
                </label>
                <div className="flex items-center gap-2 bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 min-h-[52px] focus-within:border-orange-500">
                  <span className="text-gray-500 text-base">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="flex-1 bg-transparent text-white text-base focus:outline-none"
                  />
                </div>
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                onClick={handleAdd}
                disabled={saving}
                className="w-full bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Change Order"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Delete confirm ── */}
      {confirmDeleteId && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setConfirmDeleteId(null)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
          >
            <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mt-3 mb-5" />
            <div className="px-5 pb-2">
              <p className="text-white font-bold text-lg mb-1">Delete this change order?</p>
              <p className="text-gray-400 text-sm mb-6">This can't be undone.</p>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={deleting}
                className="w-full bg-red-600 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50 mb-3"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
              <button onClick={() => setConfirmDeleteId(null)} className="w-full text-gray-400 font-semibold text-base py-3">
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
