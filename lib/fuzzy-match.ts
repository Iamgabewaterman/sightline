import type { Material } from "@/types";

function normStr(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

function bigrams(s: string): string[] {
  const n = normStr(s);
  const out: string[] = [];
  for (let i = 0; i < n.length - 1; i++) out.push(n.slice(i, i + 2));
  return out;
}

// Dice coefficient — returns 0..1
export function similarity(a: string, b: string): number {
  const bgsA = bigrams(a);
  const bgsB = bigrams(b);
  if (bgsA.length === 0 && bgsB.length === 0) return 1;
  if (bgsA.length === 0 || bgsB.length === 0) return 0;
  const setB = new Set(bgsB);
  let shared = 0;
  for (const bg of bgsA) if (setB.has(bg)) shared++;
  return (2 * shared) / (bgsA.length + bgsB.length);
}

export interface MaterialMatch {
  material: Material;
  confidence: number;
}

// Find best unlinked material matching name+cost above threshold (default 0.8)
export function findBestMaterialMatch(
  name: string,
  unitCost: number | null,
  materials: Material[],
  threshold = 0.8,
): MaterialMatch | null {
  let best: MaterialMatch | null = null;
  for (const mat of materials) {
    if (mat.receipt_id) continue; // skip already-documented materials
    const sim = similarity(name, mat.name);
    if (sim < threshold) continue;
    // If both have costs, require same ballpark (within 50%)
    if (unitCost !== null && mat.unit_cost !== null) {
      const ratio = Math.min(unitCost, mat.unit_cost) / Math.max(unitCost, mat.unit_cost);
      if (ratio < 0.5) continue;
    }
    if (!best || sim > best.confidence) best = { material: mat, confidence: sim };
  }
  return best;
}
