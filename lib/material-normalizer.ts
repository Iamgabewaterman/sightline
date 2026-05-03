// Bigram (Dice coefficient) similarity — no external dependencies
function collectBigrams(str: string): Record<string, number> {
  const obj: Record<string, number> = {};
  for (let i = 0; i < str.length - 1; i++) {
    const bg = str.slice(i, i + 2);
    obj[bg] = (obj[bg] ?? 0) + 1;
  }
  return obj;
}

export function bigramSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const ba = collectBigrams(a);
  const bb = collectBigrams(b);
  let totalA = 0;
  let totalB = 0;
  let intersection = 0;
  for (const cnt of Object.values(ba)) totalA += cnt;
  for (const cnt of Object.values(bb)) totalB += cnt;
  for (const [bg, cnt] of Object.entries(ba)) {
    intersection += Math.min(cnt, bb[bg] ?? 0);
  }
  if (totalA + totalB === 0) return 0;
  return (2 * intersection) / (totalA + totalB);
}

// Sorted longest-first so longer brand names are checked before shorter prefixes
const BRAND_PREFIXES = [
  "simpson strong-tie", "simpson strong tie",
  "owens corning",
  "georgia-pacific", "georgia pacific",
  "national gypsum",
  "louisiana-pacific", "lp building products",
  "huber engineered woods",
  "weyerhaeuser",
  "benjamin moore",
  "sherwin-williams", "sherwin williams",
  "certainteed",
  "titebond", "loctite",
  "quikrete", "sakrete",
  "huber", "tyvek", "dupont", "tamko", "platon",
  "simpson", "behr", "usg", "dow",
].sort((a, b) => b.length - a.length);

export function normalizeMaterialName(raw: string): string {
  let s = raw.trim().toLowerCase().replace(/\s+/g, " ");

  // Strip known brand prefix
  for (const brand of BRAND_PREFIXES) {
    if (s.startsWith(brand + " ")) {
      s = s.slice(brand.length + 1).trim();
      break;
    }
  }

  // "2x4x8" → "2x4 8ft"
  s = s.replace(/^(\d+x\d+)x(\d+)$/, "$1 $2ft");
  // "2x4 x 8" or "2x4-8" → "2x4 8ft"
  s = s.replace(/^(\d+x\d+)\s*[x-]\s*(\d+)$/, "$1 $2ft");

  // Fractional inch: "3/4\"" or "3/4 in" → "3/4in"
  s = s.replace(/(\d+\/\d+)\s*"/g, "$1in");
  s = s.replace(/(\d+\/\d+)\s*-?\s*in\b/g, "$1in");

  // Weight: "80#" or "80 lb" → "80lb"
  s = s.replace(/(\d+)\s*#\b/g, "$1lb");
  s = s.replace(/(\d+)\s+lb\b/g, "$1lb");

  return s.replace(/\s+/g, " ").trim();
}

// Returns the id of the best-matching candidate at or above `threshold`, or null.
export function fuzzyFindMatch(
  normalizedQuery: string,
  candidates: Array<{ id: string; normalizedName: string }>,
  threshold = 0.8
): string | null {
  let bestId: string | null = null;
  let bestScore = threshold - 0.001; // must strictly beat threshold
  for (const c of candidates) {
    const score = bigramSimilarity(normalizedQuery, c.normalizedName);
    if (score > bestScore) {
      bestScore = score;
      bestId = c.id;
    }
  }
  return bestId;
}
