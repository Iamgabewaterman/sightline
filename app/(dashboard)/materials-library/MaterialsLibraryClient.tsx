"use client";

import { useState, useMemo } from "react";
import { LibraryMaterial, mergeMaterialsHistory, deleteMaterialHistory } from "@/app/actions/materials-library";

type SortKey = "use_count" | "name" | "last_used_at";

export default function MaterialsLibraryClient({
  initialMaterials,
}: {
  initialMaterials: LibraryMaterial[];
}) {
  const [materials, setMaterials] = useState<LibraryMaterial[]>(initialMaterials);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("use_count");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [merging, setMerging] = useState(false);
  const [mergeKeepId, setMergeKeepId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = q
      ? materials.filter(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            m.alternate_names.some((a) => a.toLowerCase().includes(q))
        )
      : materials;

    if (sort === "use_count") list = [...list].sort((a, b) => b.use_count - a.use_count);
    else if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "last_used_at") {
      list = [...list].sort((a, b) => {
        const da = a.last_used_at ?? "";
        const db = b.last_used_at ?? "";
        return db.localeCompare(da);
      });
    }
    return list;
  }, [materials, search, sort]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this material from your library?")) return;
    setBusy(true);
    const result = await deleteMaterialHistory(id);
    if (result.error) setError(result.error);
    else setMaterials((prev) => prev.filter((m) => m.id !== id));
    setBusy(false);
  }

  function startMerge() {
    if (selected.size < 2) return;
    const ids = Array.from(selected);
    setMergeKeepId(ids[0]);
    setMerging(true);
  }

  async function confirmMerge() {
    if (!mergeKeepId || selected.size < 2) return;
    const mergeIds = Array.from(selected).filter((id) => id !== mergeKeepId);
    setBusy(true);
    setError("");
    const result = await mergeMaterialsHistory(mergeKeepId, mergeIds);
    if (result.error) {
      setError(result.error);
    } else {
      const keepMat = materials.find((m) => m.id === mergeKeepId)!;
      const mergedAlts = new Set(keepMat.alternate_names);
      let totalUses = keepMat.use_count;
      for (const id of mergeIds) {
        const m = materials.find((x) => x.id === id);
        if (m) {
          mergedAlts.add(m.name);
          m.alternate_names.forEach((a) => mergedAlts.add(a));
          totalUses += m.use_count;
        }
      }
      mergedAlts.delete(keepMat.name);
      setMaterials((prev) =>
        prev
          .filter((m) => !mergeIds.includes(m.id))
          .map((m) =>
            m.id === mergeKeepId
              ? { ...m, use_count: totalUses, alternate_names: Array.from(mergedAlts) }
              : m
          )
      );
      setSelected(new Set());
      setMerging(false);
      setMergeKeepId(null);
    }
    setBusy(false);
  }

  const inputClass =
    "bg-[#1A1A1A] border border-[#2a2a2a] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500";

  return (
    <div className="px-4 pt-6 pb-32 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <a href="/jobs" className="text-gray-500 text-sm mb-3 inline-block active:opacity-70">
          ← Back
        </a>
        <h1 className="text-white font-bold text-2xl">Materials Library</h1>
        <p className="text-gray-500 text-sm mt-1">
          {materials.length} saved materials · prices updated from your jobs
        </p>
      </div>

      {/* Search + Sort */}
      <div className="flex gap-2 mb-4">
        <input
          type="search"
          placeholder="Search materials…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`flex-1 ${inputClass}`}
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className={inputClass}
        >
          <option value="use_count">Most used</option>
          <option value="last_used_at">Recent</option>
          <option value="name">A–Z</option>
        </select>
      </div>

      {/* Merge controls */}
      {selected.size >= 2 && !merging && (
        <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3 mb-4">
          <p className="text-blue-300 text-sm flex-1">{selected.size} selected</p>
          <button
            onClick={() => setSelected(new Set())}
            className="text-gray-400 text-sm px-3 py-2 rounded-lg border border-[#2a2a2a] active:scale-95"
          >
            Clear
          </button>
          <button
            onClick={startMerge}
            className="text-white text-sm font-semibold px-4 py-2 bg-blue-600 rounded-lg active:scale-95"
          >
            Merge
          </button>
        </div>
      )}

      {/* Merge dialog */}
      {merging && (
        <div className="bg-[#1A1A1A] border border-blue-500/40 rounded-xl px-4 py-4 mb-4">
          <p className="text-white font-semibold mb-2">Choose primary record to keep</p>
          <p className="text-gray-400 text-xs mb-3">
            The primary name is kept; all others become alternate names.
          </p>
          <div className="flex flex-col gap-2 mb-4">
            {Array.from(selected).map((id) => {
              const m = materials.find((x) => x.id === id)!;
              return (
                <button
                  key={id}
                  onClick={() => setMergeKeepId(id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left active:scale-95 transition-all ${
                    mergeKeepId === id
                      ? "border-orange-500 bg-orange-500/10"
                      : "border-[#2a2a2a] bg-[#242424]"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 shrink-0 ${
                      mergeKeepId === id ? "border-orange-500 bg-orange-500" : "border-gray-600"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{m.name}</p>
                    <p className="text-gray-500 text-xs">Used {m.use_count}x</p>
                  </div>
                </button>
              );
            })}
          </div>
          {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => { setMerging(false); setMergeKeepId(null); }}
              className="flex-1 py-3 rounded-xl border border-[#2a2a2a] text-gray-400 text-sm font-semibold active:scale-95"
            >
              Cancel
            </button>
            <button
              onClick={confirmMerge}
              disabled={!mergeKeepId || busy}
              className="flex-1 py-3 rounded-xl bg-orange-500 text-white text-sm font-bold active:scale-95 disabled:opacity-50"
            >
              {busy ? "Merging…" : "Confirm Merge"}
            </button>
          </div>
        </div>
      )}

      {error && !merging && (
        <p className="text-red-400 text-sm mb-3">{error}</p>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl py-12 flex items-center justify-center">
          <p className="text-gray-500 text-sm">
            {search ? "No materials match your search" : "No materials saved yet"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((m) => {
            const isSelected = selected.has(m.id);
            return (
              <div
                key={m.id}
                className={`bg-[#1A1A1A] border rounded-xl px-4 py-4 transition-colors ${
                  isSelected ? "border-orange-500/60" : "border-[#2a2a2a]"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Select checkbox */}
                  <button
                    onClick={() => toggleSelect(m.id)}
                    className={`mt-0.5 w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center active:scale-95 transition-all ${
                      isSelected
                        ? "border-orange-500 bg-orange-500"
                        : "border-[#333]"
                    }`}
                  >
                    {isSelected && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-white font-semibold text-base leading-tight">{m.name}</p>
                        {m.alternate_names.length > 0 && (
                          <p className="text-gray-500 text-xs mt-0.5 truncate">
                            Also: {m.alternate_names.slice(0, 3).join(", ")}
                            {m.alternate_names.length > 3 && ` +${m.alternate_names.length - 3}`}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(m.id)}
                        disabled={busy}
                        className="text-gray-600 text-xs px-3 py-1.5 rounded-lg border border-[#2a2a2a] active:scale-95 shrink-0 disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="flex items-center gap-3 mt-2">
                      <div className="bg-[#242424] rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                        <span className="text-gray-400 text-xs">Used</span>
                        <span className="text-white font-bold text-sm">{m.use_count}×</span>
                      </div>
                      {m.unit_cost != null && (
                        <div className="bg-[#242424] rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                          <span className="text-orange-500 font-bold text-sm">
                            ${m.unit_cost.toFixed(2)}
                          </span>
                          <span className="text-gray-500 text-xs">/{m.unit || "ea"}</span>
                        </div>
                      )}
                      {m.last_used_at && (
                        <span className="text-gray-600 text-xs">
                          {new Date(m.last_used_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected.size === 1 && (
        <p className="text-gray-600 text-xs text-center mt-4">
          Select one more to enable merge
        </p>
      )}
    </div>
  );
}
