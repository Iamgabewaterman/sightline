"use client";

import { useState, useRef, useEffect } from "react";
import { PunchListItem } from "@/types";
import { addPunchListItem, togglePunchListItem, deletePunchListItem } from "@/app/actions/punch-list";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function PunchListSection({
  jobId,
  initialItems,
}: {
  jobId: string;
  initialItems: PunchListItem[];
}) {
  const [items, setItems] = useState<PunchListItem[]>(initialItems);
  const [showAdd, setShowAdd] = useState(false);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showAdd) inputRef.current?.focus();
  }, [showAdd]);

  const open = items.filter((i) => !i.completed);
  const done = items.filter((i) => i.completed);
  const total = items.length;
  const completedCount = done.length;

  async function handleAdd() {
    if (!description.trim()) return;
    setSaving(true);
    setAddError("");
    const res = await addPunchListItem(jobId, description);
    setSaving(false);
    if (res.error) { setAddError(res.error); return; }
    setItems((prev) => [...prev, res.item!]);
    setDescription("");
    setShowAdd(false);
  }

  async function handleToggle(item: PunchListItem) {
    setTogglingId(item.id);
    // Optimistic
    setItems((prev) => prev.map((i) =>
      i.id === item.id ? { ...i, completed: !i.completed, completed_at: !i.completed ? new Date().toISOString() : null } : i
    ));
    const res = await togglePunchListItem(item.id, !item.completed);
    setTogglingId(null);
    if (res.item) {
      setItems((prev) => prev.map((i) => i.id === res.item!.id ? res.item! : i));
    }
  }

  async function handleDelete(id: string) {
    await deletePunchListItem(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    setConfirmDeleteId(null);
  }

  // Sort: open first (by created_at), then done (by completed_at desc)
  const sorted = [
    ...open.sort((a, b) => a.created_at.localeCompare(b.created_at)),
    ...done.sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? "")),
  ];

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-white font-bold text-xl">Punch List</h2>
          {total > 0 && (
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
              completedCount === total
                ? "bg-green-500/20 border-green-500/40 text-green-400"
                : "bg-[#2a2a2a] border-[#333] text-gray-400"
            }`}>
              {completedCount} of {total}
            </span>
          )}
        </div>
        <button
          onClick={() => { setShowAdd((s) => !s); setAddError(""); setDescription(""); }}
          className="text-white font-semibold text-sm bg-[#1A1A1A] border border-[#2a2a2a] px-4 py-3 rounded-xl active:scale-95 transition-transform"
        >
          {showAdd ? "Cancel" : "+ Add Item"}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 mb-4 flex flex-col gap-3">
          <input
            ref={inputRef}
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            placeholder="Describe the snag item…"
            className="bg-[#242424] border border-[#333] text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500 w-full"
          />
          {addError && <p className="text-red-400 text-sm">{addError}</p>}
          <button
            onClick={handleAdd}
            disabled={saving || !description.trim()}
            className="w-full bg-orange-500 text-white font-bold py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add Item"}
          </button>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && !showAdd && (
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl py-10 text-center">
          <p className="text-gray-500 text-sm">No punch list items yet</p>
          <p className="text-gray-600 text-xs mt-1">Add snag items as you identify them during the job.</p>
        </div>
      )}

      {/* Items */}
      {sorted.length > 0 && (
        <div className="flex flex-col gap-2">
          {sorted.map((item) => (
            <div
              key={item.id}
              className={`bg-[#1A1A1A] border rounded-xl px-4 py-4 flex items-start gap-4 ${
                item.completed ? "border-[#222] opacity-70" : "border-[#2a2a2a]"
              }`}
            >
              {/* Checkbox — big tap target */}
              <button
                onClick={() => handleToggle(item)}
                disabled={togglingId === item.id}
                className={`w-7 h-7 mt-0.5 shrink-0 rounded-lg border-2 flex items-center justify-center active:scale-90 transition-all ${
                  item.completed
                    ? "bg-green-500 border-green-500"
                    : "bg-transparent border-[#444] active:border-orange-500"
                }`}
                aria-label={item.completed ? "Mark incomplete" : "Mark complete"}
              >
                {item.completed && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </button>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className={`text-base leading-snug ${item.completed ? "line-through text-gray-500" : "text-white"}`}>
                  {item.description}
                </p>
                {item.completed && item.completed_at && (
                  <p className="text-green-600 text-xs mt-0.5">✓ {fmtDate(item.completed_at)}</p>
                )}
                {!item.completed && (
                  <p className="text-gray-600 text-xs mt-0.5">Added {fmtDate(item.created_at)}</p>
                )}
              </div>

              {/* Delete */}
              <button
                onClick={() => setConfirmDeleteId(item.id)}
                className="text-[#333] hover:text-red-400 w-9 h-9 flex items-center justify-center rounded-lg active:scale-90 transition-colors shrink-0"
                aria-label="Delete item"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                </svg>
              </button>
            </div>
          ))}

          {/* All done banner */}
          {total > 0 && completedCount === total && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <p className="text-green-400 text-sm font-semibold">All punch list items complete</p>
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation sheet */}
      {confirmDeleteId && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setConfirmDeleteId(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl px-5 pt-6 pb-10">
            <p className="text-white font-bold text-lg mb-1">Remove this item?</p>
            <p className="text-gray-400 text-sm mb-6">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteId(null)}
                className="flex-1 bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold py-4 rounded-xl active:scale-95">
                Cancel
              </button>
              <button onClick={() => handleDelete(confirmDeleteId)}
                className="flex-1 bg-red-600 text-white font-bold py-4 rounded-xl active:scale-95">
                Remove
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
