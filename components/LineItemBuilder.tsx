"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const GLOBAL_PRESETS = [
  "Demo and debris removal",
  "Site preparation and cleanup",
  "Project management and supervision",
  "Permits and inspections",
  "Equipment and tool rental",
  "Framing and structural work",
  "Foundation work",
  "Concrete and flatwork",
  "Roofing and flashing",
  "Insulation",
  "Drywall and patching",
  "Interior painting",
  "Flooring installation",
  "Tile work",
  "Cabinetry and millwork",
  "Trim and finish carpentry",
  "Door and window installation",
  "Exterior painting",
  "Siding installation",
  "Deck and patio construction",
  "Fencing",
  "Gutters and drainage",
  "Plumbing rough-in and finish",
  "Electrical rough-in and finish",
  "HVAC installation and ducting",
  "Water heater installation",
  "Water damage remediation",
  "Fire damage remediation",
  "Mold remediation",
  "Structural drying",
  "Content pack-out and storage",
  "Professional services",
  "Labor and installation",
  "Materials and supplies",
];

export interface LineItemRow {
  id: string;
  name: string;
  amount: string;
}

export function newLineItemRow(): LineItemRow {
  return { id: Math.random().toString(36).slice(2), name: "", amount: "" };
}

export function rowsToLineItems(rows: LineItemRow[]): Array<{ name: string; amount: number }> {
  return rows.filter((r) => r.name.trim()).map((r) => ({
    name: r.name.trim(),
    amount: parseFloat(r.amount) || 0,
  }));
}

interface Props {
  items: LineItemRow[];
  onItemsChange: (items: LineItemRow[]) => void;
  totalToMatch: number;
}

export default function LineItemBuilder({ items, onItemsChange, totalToMatch }: Props) {
  const [usedLabels, setUsedLabels] = useState<string[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const amountRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const suppressBlurRef = useRef(false);
  const dragIndexRef = useRef<number | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("line_item_labels")
        .select("label")
        .eq("user_id", user.id)
        .order("use_count", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(50)
        .then(({ data }) => { if (data) setUsedLabels(data.map((d: { label: string }) => d.label)); });
    });
  }, []);

  const runningTotal = items.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const mismatch = totalToMatch > 0 && Math.abs(runningTotal - totalToMatch) > 0.01;
  const diff = runningTotal - totalToMatch;

  function getSuggestions(query: string): string[] {
    const q = query.toLowerCase().trim();
    const matched = usedLabels.filter((l) => !q || l.toLowerCase().includes(q));
    const usedSet = new Set(usedLabels.map((l) => l.toLowerCase()));
    const presets = GLOBAL_PRESETS.filter(
      (l) => !usedSet.has(l.toLowerCase()) && (!q || l.toLowerCase().includes(q))
    );
    return [...matched, ...presets].slice(0, 8);
  }

  function updateItem(id: string, field: "name" | "amount", value: string) {
    onItemsChange(items.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function removeItem(id: string) {
    const next = items.filter((r) => r.id !== id);
    onItemsChange(next.length ? next : [newLineItemRow()]);
  }

  function selectSuggestion(id: string, label: string) {
    suppressBlurRef.current = false;
    onItemsChange(items.map((r) => (r.id === id ? { ...r, name: label } : r)));
    setFocusedId(null);
    setTimeout(() => amountRefs.current[id]?.focus(), 30);
  }

  // HTML5 drag-to-reorder
  function onDragStart(e: React.DragEvent, i: number) {
    dragIndexRef.current = i;
    e.dataTransfer.effectAllowed = "move";
    (e.currentTarget as HTMLElement).style.opacity = "0.5";
  }

  function onDragOver(e: React.DragEvent, i: number) {
    e.preventDefault();
    const from = dragIndexRef.current;
    if (from === null || from === i) return;
    const next = [...items];
    const [removed] = next.splice(from, 1);
    next.splice(i, 0, removed);
    dragIndexRef.current = i;
    onItemsChange(next);
  }

  function onDragEnd(e: React.DragEvent) {
    (e.currentTarget as HTMLElement).style.opacity = "1";
    dragIndexRef.current = null;
  }

  const ic = "bg-[#1a1a1a] border border-[#2a2a2a] text-white text-sm rounded-lg focus:outline-none focus:border-orange-500";

  return (
    <div>
      <div className="flex flex-col gap-2 mb-3">
        {items.map((row, i) => {
          const suggestions = focusedId === row.id ? getSuggestions(row.name) : [];
          return (
            <div
              key={row.id}
              draggable
              onDragStart={(e) => onDragStart(e, i)}
              onDragOver={(e) => onDragOver(e, i)}
              onDragEnd={onDragEnd}
              className="flex gap-2 items-center"
            >
              {/* Drag handle */}
              <div className="text-gray-600 cursor-grab active:cursor-grabbing select-none shrink-0 text-xl leading-none px-1">
                ⠿
              </div>

              {/* Label + suggestion dropdown */}
              <div className="relative flex-1 min-w-0">
                <input
                  value={row.name}
                  onChange={(e) => updateItem(row.id, "name", e.target.value)}
                  onFocus={() => setFocusedId(row.id)}
                  onBlur={() => {
                    if (suppressBlurRef.current) { suppressBlurRef.current = false; return; }
                    setFocusedId(null);
                  }}
                  placeholder="Line item description"
                  className={ic + " w-full px-3 min-h-[44px]"}
                />
                {suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-[#1e1e1e] border border-[#333] rounded-xl shadow-2xl overflow-hidden">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onMouseDown={() => { suppressBlurRef.current = true; }}
                        onClick={() => selectSuggestion(row.id, s)}
                        className="w-full text-left px-4 py-3 text-sm text-gray-300 active:bg-orange-500/20 active:text-orange-400 border-b border-[#2a2a2a] last:border-0 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Amount */}
              <div className="relative shrink-0 w-28">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">$</span>
                <input
                  ref={(el) => { amountRefs.current[row.id] = el; }}
                  value={row.amount}
                  onChange={(e) => updateItem(row.id, "amount", e.target.value)}
                  placeholder="0"
                  inputMode="decimal"
                  className={ic + " pl-6 pr-3 min-h-[44px] w-full"}
                />
              </div>

              {/* Remove */}
              <button
                type="button"
                onClick={() => removeItem(row.id)}
                className="text-gray-600 active:text-red-400 p-2 shrink-0 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {/* Running total + mismatch */}
      <div className={`flex justify-between items-start px-4 py-3 rounded-xl mb-3 ${
        mismatch ? "bg-red-500/15 border border-red-500/40" : "bg-[#1a1a1a] border border-[#2a2a2a]"
      }`}>
        <div>
          <p className={`text-sm font-semibold ${mismatch ? "text-red-400" : "text-gray-400"}`}>
            Line items total
          </p>
          {mismatch && (
            <p className="text-red-400 text-xs font-bold mt-0.5">
              {diff > 0
                ? `⚠ $${Math.round(Math.abs(diff)).toLocaleString()} over invoice total — fix before sending`
                : `⚠ $${Math.round(Math.abs(diff)).toLocaleString()} under invoice total — fix before sending`}
            </p>
          )}
        </div>
        <span className={`font-bold font-mono text-base shrink-0 ml-3 ${mismatch ? "text-red-400" : "text-gray-300"}`}>
          ${Math.round(runningTotal).toLocaleString()}
          {totalToMatch > 0 && (
            <span className="text-gray-600 text-xs font-normal"> / ${Math.round(totalToMatch).toLocaleString()}</span>
          )}
        </span>
      </div>

      {/* Add row */}
      <button
        type="button"
        onClick={() => onItemsChange([...items, newLineItemRow()])}
        className="w-full bg-[#242424] border border-[#2a2a2a] text-gray-400 font-semibold text-sm py-3 rounded-xl active:scale-95 transition-transform"
      >
        + Add Row
      </button>
    </div>
  );
}
