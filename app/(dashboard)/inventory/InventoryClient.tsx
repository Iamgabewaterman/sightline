"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ShopInventoryItem } from "@/types";
import { pullFromInventory, adjustInventoryQty, deleteInventoryItem } from "@/app/actions/inventory";

interface Props {
  initialItems: ShopInventoryItem[];
  activeJobs: { id: string; name: string; job_number: string | null }[];
  totalItems: number;
  totalValue: number;
}

const CATEGORY_ORDER = [
  "Lumber & Framing",
  "Sheet Goods",
  "Roofing",
  "Concrete & Masonry",
  "Plumbing & Piping",
  "Electrical & Conduit",
  "Hardware & Fasteners",
  "Insulation",
  "Finishing",
  "Agricultural & Barn",
  "Other",
];

function fmt$(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function groupItems(items: ShopInventoryItem[]): Record<string, ShopInventoryItem[]> {
  const groups: Record<string, ShopInventoryItem[]> = {};
  for (const item of items) {
    const cat = item.material_category ?? "Other";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  }
  return groups;
}

function sortedCategories(groups: Record<string, ShopInventoryItem[]>): string[] {
  return Object.keys(groups).sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

interface UseOnJobModalProps {
  item: ShopInventoryItem;
  activeJobs: { id: string; name: string; job_number: string | null }[];
  onClose: () => void;
  onPulled: (itemId: string, qtyPulled: number) => void;
}

function UseOnJobModal({ item, activeJobs, onClose, onPulled }: UseOnJobModalProps) {
  const [selectedJobId, setSelectedJobId] = useState("");
  const [qty, setQty] = useState(item.quantity.toString());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handlePull() {
    const parsedQty = parseFloat(qty);
    if (!selectedJobId) { setError("Select a job."); return; }
    if (!parsedQty || parsedQty <= 0) { setError("Enter a valid quantity."); return; }
    if (parsedQty > item.quantity) { setError(`Max available: ${item.quantity} ${item.unit}`); return; }
    setLoading(true); setError("");
    const result = await pullFromInventory(item.id, selectedJobId, parsedQty);
    if (result.error) { setError(result.error); setLoading(false); return; }
    onPulled(item.id, parsedQty);
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl px-5 pt-5 pb-10">
        <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mb-5" />
        <p className="text-white font-bold text-lg mb-1">Use on Job</p>
        <p className="text-gray-500 text-sm mb-4">{item.material_name} · {item.quantity} {item.unit} available</p>

        <div className="mb-4">
          <label className="text-gray-400 text-xs uppercase tracking-wider block mb-1.5">Select Job</label>
          {activeJobs.length === 0 ? (
            <p className="text-gray-500 text-sm">No active jobs.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {activeJobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => setSelectedJobId(job.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-colors active:scale-95 ${
                    selectedJobId === job.id
                      ? "bg-orange-500/15 border-orange-500/50 text-orange-400"
                      : "bg-[#1A1A1A] border-[#2a2a2a] text-white"
                  }`}
                >
                  <span className="font-semibold">{job.name}</span>
                  {job.job_number && <span className="text-gray-500 text-xs ml-2">#{job.job_number}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mb-4">
          <label className="text-gray-400 text-xs uppercase tracking-wider block mb-1.5">Quantity to Pull</label>
          <div className="flex items-center gap-2">
            <input
              type="number" inputMode="decimal" min="0.01" step="any"
              value={qty} onChange={(e) => setQty(e.target.value)}
              className="flex-1 bg-[#242424] border border-[#333333] text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500"
            />
            <span className="text-gray-400 text-sm font-semibold">{item.unit}</span>
          </div>
          <p className="text-gray-500 text-xs mt-1">Will be added to the job at $0 cost</p>
        </div>

        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 bg-[#1A1A1A] border border-[#2a2a2a] text-gray-300 font-semibold py-4 rounded-xl active:scale-95 transition-transform">
            Cancel
          </button>
          <button
            onClick={handlePull}
            disabled={loading || activeJobs.length === 0}
            className="flex-1 bg-orange-500 text-white font-bold py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
          >
            {loading ? "Adding..." : "Add to Job"}
          </button>
        </div>
      </div>
    </>
  );
}

interface AdjustQtyModalProps {
  item: ShopInventoryItem;
  onClose: () => void;
  onAdjusted: (itemId: string, newQty: number) => void;
}

function AdjustQtyModal({ item, onClose, onAdjusted }: AdjustQtyModalProps) {
  const [qty, setQty] = useState(item.quantity.toString());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    const parsed = parseFloat(qty);
    if (isNaN(parsed) || parsed < 0) { setError("Enter a valid quantity (0 to remove)."); return; }
    setLoading(true); setError("");
    const result = await adjustInventoryQty(item.id, parsed);
    if (result.error) { setError(result.error); setLoading(false); return; }
    onAdjusted(item.id, parsed);
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl px-5 pt-5 pb-10">
        <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mb-5" />
        <p className="text-white font-bold text-lg mb-1">Adjust Quantity</p>
        <p className="text-gray-500 text-sm mb-4">{item.material_name}</p>
        <p className="text-gray-400 text-xs mb-4">Set to 0 to remove from inventory.</p>
        <div className="flex items-center gap-2 mb-4">
          <input
            type="number" inputMode="decimal" min="0" step="any"
            value={qty} onChange={(e) => setQty(e.target.value)}
            className="flex-1 bg-[#242424] border border-[#333333] text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500"
          />
          <span className="text-gray-400 text-sm font-semibold">{item.unit}</span>
        </div>
        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 bg-[#1A1A1A] border border-[#2a2a2a] text-gray-300 font-semibold py-4 rounded-xl active:scale-95 transition-transform">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 bg-orange-500 text-white font-bold py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}

export default function InventoryClient({ initialItems, activeJobs, totalItems, totalValue }: Props) {
  const [items, setItems] = useState<ShopInventoryItem[]>(initialItems);
  const [search, setSearch] = useState("");
  const [useOnJobItem, setUseOnJobItem] = useState<ShopInventoryItem | null>(null);
  const [adjustItem, setAdjustItem] = useState<ShopInventoryItem | null>(null);
  const router = useRouter();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      i.material_name.toLowerCase().includes(q) ||
      (i.source_job_name ?? "").toLowerCase().includes(q) ||
      (i.material_category ?? "").toLowerCase().includes(q)
    );
  }, [items, search]);

  const groups = useMemo(() => groupItems(filtered), [filtered]);
  const categories = useMemo(() => sortedCategories(groups), [groups]);

  const currentTotal = items.reduce((s, i) => s + Number(i.estimated_value), 0);

  function handlePulled(itemId: string, qtyPulled: number) {
    setItems((prev) => {
      return prev
        .map((i) => i.id === itemId ? { ...i, quantity: Number(i.quantity) - qtyPulled } : i)
        .filter((i) => i.quantity > 0);
    });
    setUseOnJobItem(null);
    router.refresh();
  }

  function handleAdjusted(itemId: string, newQty: number) {
    if (newQty <= 0) {
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } else {
      setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, quantity: newQty } : i));
    }
    setAdjustItem(null);
  }

  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-8 pb-24">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-xl bg-[#1A1A1A] border border-[#2a2a2a] flex items-center justify-center active:scale-95 transition-transform shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white leading-tight">Shop Inventory</h1>
            <p className="text-gray-500 text-sm">Surplus materials in storage</p>
          </div>
        </div>

        {/* Summary card */}
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4 mb-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Items in Storage</p>
              <p className="text-white font-black text-3xl leading-none">{items.length}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Estimated Value</p>
              <p className="text-orange-500 font-black text-3xl leading-none">{fmt$(currentTotal)}</p>
            </div>
          </div>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search materials…"
              className="w-full bg-[#242424] border border-[#333333] text-white rounded-xl pl-9 pr-4 py-3 text-base placeholder:text-gray-500 focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>

        {/* Empty state */}
        {items.length === 0 && (
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl py-16 flex flex-col items-center gap-3">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
            </svg>
            <p className="text-gray-500 text-base font-semibold">No materials in storage</p>
            <p className="text-gray-600 text-sm text-center max-w-xs">Use the Dispose Surplus button on any job&apos;s material row to store leftover materials here.</p>
          </div>
        )}

        {filtered.length === 0 && items.length > 0 && (
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl py-10 text-center">
            <p className="text-gray-500 text-sm">No results for &ldquo;{search}&rdquo;</p>
          </div>
        )}

        {/* Grouped inventory list */}
        {categories.map((cat) => (
          <div key={cat} className="mb-6">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">{cat}</p>
            <div className="flex flex-col gap-3">
              {groups[cat].map((item) => (
                <div key={item.id} className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <p className="text-white font-bold text-base leading-tight">{item.material_name}</p>
                      <p className="text-orange-400 font-semibold text-sm mt-0.5">
                        {item.quantity} {item.unit}
                        {item.unit_cost != null && <span className="text-gray-500 font-normal"> · ${Number(item.unit_cost).toFixed(2)}/{item.unit}</span>}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-white font-bold text-base">{fmt$(Number(item.estimated_value))}</p>
                      <p className="text-gray-500 text-xs">est. value</p>
                    </div>
                  </div>

                  {/* Source job tag */}
                  <div className="flex items-center gap-1.5 mb-3">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
                    </svg>
                    <span className="text-gray-500 text-xs">
                      {item.source_job_name ?? "Unknown job"}
                      {item.source_job_number && ` · #${item.source_job_number}`}
                    </span>
                    <span className="text-gray-600 text-xs">· {fmtDate(item.date_stored)}</span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setUseOnJobItem(item)}
                      className="flex-1 bg-orange-500 text-white font-bold text-sm py-3 rounded-xl active:scale-95 transition-transform"
                    >
                      Use on Job
                    </button>
                    <button
                      onClick={() => setAdjustItem(item)}
                      className="flex-1 bg-[#242424] border border-[#333333] text-gray-300 font-semibold text-sm py-3 rounded-xl active:scale-95 transition-transform"
                    >
                      Adjust Qty
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {useOnJobItem && (
        <UseOnJobModal
          item={useOnJobItem}
          activeJobs={activeJobs}
          onClose={() => setUseOnJobItem(null)}
          onPulled={handlePulled}
        />
      )}

      {adjustItem && (
        <AdjustQtyModal
          item={adjustItem}
          onClose={() => setAdjustItem(null)}
          onAdjusted={handleAdjusted}
        />
      )}
    </div>
  );
}
