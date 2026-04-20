export type MegaImportType = "clients" | "jobs" | "materials" | "labor" | "expenses" | "contacts" | "unknown";

// Score columns against each type's known headers. Highest score wins.
const SIGNATURES: Record<Exclude<MegaImportType, "unknown">, string[]> = {
  clients:   ["name", "company", "phone", "email", "address", "client", "contact"],
  jobs:      ["job", "job_name", "jobname", "project", "types", "status", "site"],
  materials: ["material", "item", "unit", "quantity", "qty", "unit_cost", "cost", "length_ft", "stock"],
  labor:     ["crew", "crew_name", "hours", "hourly_rate", "rate", "worker", "employee"],
  expenses:  ["description", "vendor", "amount", "category", "expense", "receipt", "payment"],
  contacts:  ["trade", "is_subcontractor", "subcontractor", "specialty", "license"],
};

export function detectFileType(headers: string[]): MegaImportType {
  const normalized = headers.map((h) => h.toLowerCase().trim().replace(/\s+/g, "_"));

  const scores: Record<string, number> = {};
  for (const [type, keywords] of Object.entries(SIGNATURES)) {
    scores[type] = normalized.reduce((score, col) => {
      // Exact match = 2 points, partial match = 1 point
      if (keywords.includes(col)) return score + 2;
      if (keywords.some((k) => col.includes(k) || k.includes(col))) return score + 1;
      return score;
    }, 0);
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (!best || best[1] === 0) return "unknown";

  // Require at least 2 points to claim a type
  if (best[1] < 2) return "unknown";

  // Labor vs clients disambiguation: if "hours" is present, it's labor
  if (best[0] === "clients" && normalized.includes("hours")) return "labor";

  return best[0] as MegaImportType;
}
