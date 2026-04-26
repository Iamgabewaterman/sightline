export type MegaImportType = "clients" | "jobs" | "materials" | "labor" | "expenses" | "contacts" | "unknown";

// Score columns against each type's known headers. Highest score wins.
// Covers generic + QuickBooks, Jobber, Leap, JobNimbus, AccuLynx, ServiceTitan, Buildertrend, Houzz Pro
const SIGNATURES: Record<Exclude<MegaImportType, "unknown">, string[]> = {
  clients: [
    "name", "company", "phone", "email", "address", "client", "contact",
    // QuickBooks
    "customer", "customer name", "billing address", "shipping address",
    // Jobber
    "client name", "on-site contact", "billing contact",
    // Leap / Buildertrend
    "homeowner", "property owner", "lead", "lead name",
    // ServiceTitan
    "customer since", "account name",
    // Houzz Pro
    "project stage", "request source",
  ],
  jobs: [
    "job", "job_name", "jobname", "project", "types", "status", "site",
    // QuickBooks
    "class", "invoice number",
    // Jobber
    "job number", "job title", "visit", "work order",
    // Leap
    "opportunity", "claim number", "insurance claim",
    // JobNimbus
    "board", "column", "job board", "job id",
    // AccuLynx
    "work order", "contingency", "supplement",
    // Buildertrend
    "project manager", "change order",
    // Houzz Pro
    "houzz project id", "budget range",
  ],
  materials: [
    "material", "item", "unit", "quantity", "qty", "unit_cost", "cost", "length_ft", "stock",
    // QuickBooks items/purchases
    "item name", "item description", "product", "qty ordered", "purchase price",
    // Jobber
    "line item", "product/service",
    // AccuLynx / Buildertrend
    "allowance", "material cost", "material description",
    // ServiceTitan
    "part number", "part name", "inventory",
  ],
  labor: [
    "crew", "crew_name", "hours", "hourly_rate", "rate", "worker", "employee",
    // QuickBooks Time
    "duration", "time (hours)", "payroll item", "pay type",
    // Jobber
    "assigned to", "duration", "timesheet",
    // ServiceTitan
    "technician", "dispatch", "business unit",
    // Buildertrend
    "sub cost", "labor cost", "crew member",
    // Generic
    "hrs", "time spent", "logged hours",
  ],
  expenses: [
    "description", "vendor", "amount", "category", "expense", "receipt", "payment",
    // QuickBooks
    "transaction type", "debit", "credit", "memo", "split", "account", "payee",
    // Jobber
    "expense amount", "expense category",
    // ServiceTitan
    "invoice amount", "service charge",
    // General
    "total", "subtotal", "line total",
  ],
  contacts: [
    "trade", "is_subcontractor", "subcontractor", "specialty", "license",
    // General crew/sub
    "contractor", "sub name", "skill", "certification",
    // ServiceTitan
    "technician type",
    // Buildertrend
    "subs and vendors",
  ],
};

export function detectFileType(headers: string[]): MegaImportType {
  const normalized = headers.map((h) => h.toLowerCase().trim().replace(/\s+/g, "_"));

  const scores: Record<string, number> = {};
  for (const [type, keywords] of Object.entries(SIGNATURES)) {
    const normKeywords = keywords.map((k) => k.toLowerCase().trim().replace(/\s+/g, "_"));
    scores[type] = normalized.reduce((score, col) => {
      if (normKeywords.includes(col)) return score + 2;
      if (normKeywords.some((k) => col.includes(k) || k.includes(col))) return score + 1;
      return score;
    }, 0);
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (!best || best[1] === 0) return "unknown";
  if (best[1] < 2) return "unknown";

  // Labor vs clients disambiguation: if "hours" or "duration" is present, it's labor
  if (best[0] === "clients" && (normalized.includes("hours") || normalized.includes("duration"))) return "labor";
  // Expenses vs jobs disambiguation: if "transaction type" present, lean expenses
  if (best[0] === "jobs" && normalized.includes("transaction_type")) return "expenses";

  return best[0] as MegaImportType;
}
