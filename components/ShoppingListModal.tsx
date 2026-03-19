"use client";

import { useState, useMemo } from "react";
import { Material } from "@/types";
import { generateShoppingListPDF } from "@/lib/generateShoppingListPDF";
import { createClient } from "@/lib/supabase/client";

const CAT_LABELS: Record<string, string> = {
  materials: "Materials", equipment: "Equipment", labor: "Labor",
  vehicle: "Vehicle", subcontractor: "Subcontractors", permits: "Permits",
  insurance: "Insurance", other: "Other",
};

function fmtDate() {
  return new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function fmtCost(n: number) {
  return "$" + Math.round(n).toLocaleString();
}

interface ShoppingItem {
  id: string;
  name: string;
  qtyNeeded: number;
  unit: string;
  unitCost: number | null;
  category: string;
}

function getShoppingItems(materials: Material[]): ShoppingItem[] {
  const items: ShoppingItem[] = [];
  for (const m of materials) {
    const ordered = Number(m.quantity_ordered ?? 0);
    const used = m.quantity_used !== null ? Number(m.quantity_used) : null;

    if (ordered === 0) {
      // Not purchased yet — quantity to buy is qty_used (planned) or unknown
      items.push({
        id: m.id,
        name: m.name,
        qtyNeeded: used !== null ? used : 0,
        unit: m.unit,
        unitCost: m.unit_cost !== null ? Number(m.unit_cost) : null,
        category: m.category,
      });
    } else if (used !== null && used > ordered) {
      // Need to reorder
      items.push({
        id: m.id,
        name: m.name,
        qtyNeeded: used - ordered,
        unit: m.unit,
        unitCost: m.unit_cost !== null ? Number(m.unit_cost) : null,
        category: m.category,
      });
    }
  }
  return items;
}

export default function ShoppingListModal({
  jobName,
  materials,
  onClose,
}: {
  jobName: string;
  materials: Material[];
  onClose: () => void;
}) {
  const allItems = useMemo(() => getShoppingItems(materials), [materials]);
  const [checked, setChecked] = useState<Set<string>>(() => new Set(allItems.map((i) => i.id)));
  const [generating, setGenerating] = useState(false);

  const selectedItems = allItems.filter((i) => checked.has(i.id));

  const estimatedTotal = selectedItems.reduce((s, i) => {
    if (i.unitCost !== null && i.qtyNeeded > 0) return s + i.qtyNeeded * i.unitCost;
    return s;
  }, 0);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, ShoppingItem[]>();
    for (const item of allItems) {
      const cat = item.category ?? "other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    return map;
  }, [allItems]);

  function toggleItem(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function buildShareText(): string {
    const lines: string[] = [];
    lines.push(`Shopping List — ${jobName}`);
    lines.push(fmtDate());
    lines.push("");

    Array.from(grouped.entries()).forEach(([cat, items]) => {
      const visibleItems = items.filter((i) => checked.has(i.id));
      if (visibleItems.length === 0) return;
      lines.push(`${CAT_LABELS[cat] ?? cat}:`);
      for (const item of visibleItems) {
        const qty = item.qtyNeeded > 0
          ? `× ${item.qtyNeeded % 1 === 0 ? item.qtyNeeded : item.qtyNeeded.toFixed(2)}`
          : "";
        lines.push(`□ ${item.name} ${item.unit} ${qty}`.trim());
      }
      lines.push("");
    });

    if (estimatedTotal > 0) {
      lines.push(`Estimated Total: ${fmtCost(estimatedTotal)}`);
    }
    return lines.join("\n").trim();
  }

  async function handleShare() {
    const text = buildShareText();
    if (navigator.share) {
      try {
        await navigator.share({ title: `Shopping List — ${jobName}`, text });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(text);
      alert("Copied to clipboard!");
    }
  }

  async function handleExportPDF() {
    setGenerating(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { data: bp } = user
        ? await supabase.from("business_profiles").select("business_name, owner_name").eq("user_id", user.id).maybeSingle()
        : { data: null };

      await generateShoppingListPDF({
        jobName,
        items: selectedItems,
        businessProfile: bp,
      });
    } finally {
      setGenerating(false);
    }
  }

  if (allItems.length === 0) {
    return (
      <>
        <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose} />
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl px-5 pt-6"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}>
          <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mb-5" />
          <p className="text-white font-bold text-lg mb-2">Shopping List</p>
          <p className="text-gray-400 text-sm mb-6">
            No items need to be purchased. Materials are either fully ordered or usage hasn't exceeded what was ordered.
          </p>
          <button onClick={onClose} className="w-full bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold text-base py-4 rounded-xl active:scale-95">
            Close
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl flex flex-col"
        style={{
          maxHeight: "90vh",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}>
        {/* Handle */}
        <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mt-3 shrink-0" />

        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-[#2a2a2a] shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white font-bold text-lg">Shopping List</p>
              <p className="text-gray-500 text-sm">{jobName}</p>
            </div>
            <button onClick={onClose} className="text-gray-500 text-2xl w-9 h-9 flex items-center justify-center">×</button>
          </div>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {Array.from(grouped.entries()).map(([cat, items]) => (
            <div key={cat} className="mb-4">
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">
                {CAT_LABELS[cat] ?? cat}
              </p>
              <div className="flex flex-col gap-1">
                {items.map((item) => {
                  const isChecked = checked.has(item.id);
                  const cost = item.unitCost !== null && item.qtyNeeded > 0
                    ? item.qtyNeeded * item.unitCost
                    : null;
                  const qtyLabel = item.qtyNeeded > 0
                    ? `${item.qtyNeeded % 1 === 0 ? item.qtyNeeded : item.qtyNeeded.toFixed(2)} ${item.unit}`
                    : item.unit;

                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleItem(item.id)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors active:scale-[0.98] ${
                        isChecked
                          ? "bg-[#1A1A1A] border-[#2a2a2a]"
                          : "bg-[#111] border-[#1a1a1a] opacity-50"
                      }`}
                    >
                      {/* Checkbox */}
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                        isChecked ? "bg-orange-500 border-orange-500" : "border-gray-600"
                      }`}>
                        {isChecked && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0 text-left">
                        <p className={`font-semibold text-sm leading-snug ${isChecked ? "text-white" : "text-gray-500"}`}>
                          {item.name}
                        </p>
                        <p className="text-gray-500 text-xs mt-0.5">{qtyLabel}</p>
                      </div>
                      {/* Cost */}
                      {cost !== null && (
                        <span className={`font-semibold text-sm shrink-0 ${isChecked ? "text-orange-400" : "text-gray-600"}`}>
                          {fmtCost(cost)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer: total + actions */}
        <div className="px-5 pt-3 pb-4 border-t border-[#2a2a2a] shrink-0">
          {estimatedTotal > 0 && (
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-400 text-sm font-semibold">Estimated Total</p>
              <p className="text-orange-500 font-black text-2xl">{fmtCost(estimatedTotal)}</p>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleShare}
              disabled={selectedItems.length === 0}
              className="flex-1 flex items-center justify-center gap-2 bg-[#1A1A1A] border border-[#2a2a2a] text-white font-semibold text-base py-4 rounded-xl active:scale-95 disabled:opacity-40"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              Share List
            </button>
            <button
              onClick={handleExportPDF}
              disabled={generating || selectedItems.length === 0}
              className="flex-1 bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 disabled:opacity-40"
            >
              {generating ? "Building..." : "Export PDF"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
