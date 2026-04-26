// Detect which contractor software platform a CSV export came from

export type PlatformName =
  | "QuickBooks"
  | "Jobber"
  | "Leap"
  | "JobNimbus"
  | "AccuLynx"
  | "ServiceTitan"
  | "Buildertrend"
  | "HouzzPro"
  | "generic";

export interface PlatformDetection {
  platform: PlatformName;
  confidence: "high" | "low";
}

const PLATFORM_SIGNATURES: Record<Exclude<PlatformName, "generic">, string[]> = {
  QuickBooks:    ["transaction type", "split", "memo", "debit", "credit", "account", "num", "clr"],
  Jobber:        ["job number", "job title", "on-site contact", "assigned to", "duration", "visit"],
  Leap:          ["opportunity", "lead source", "salesperson", "adjuster", "claim number", "insurance claim", "contingency amount"],
  JobNimbus:     ["board", "column", "primary contact", "source", "assignees", "job id", "job board"],
  AccuLynx:      ["work order", "contingency", "supplement", "deductible", "mortgage", "acculynx"],
  ServiceTitan:  ["customer since", "business unit", "tag name", "service agreement", "dispatch", "technician"],
  Buildertrend:  ["project manager", "allowance", "change order", "lien waiver", "buildertrend"],
  HouzzPro:      ["houzz project id", "project stage", "request source", "budget range", "houzz", "lead date"],
};

export function detectPlatform(headers: string[]): PlatformDetection {
  const normalized = headers.map((h) => h.toLowerCase().trim().replace(/[_-]/g, " "));

  const scores: Record<string, number> = {};
  for (const [platform, sigs] of Object.entries(PLATFORM_SIGNATURES)) {
    scores[platform] = sigs.reduce((score, sig) => {
      if (normalized.some((h) => h === sig)) return score + 2;
      if (normalized.some((h) => h.includes(sig) || sig.includes(h))) return score + 1;
      return score;
    }, 0);
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const best = sorted[0];

  if (!best || best[1] === 0) return { platform: "generic", confidence: "low" };
  return {
    platform: best[0] as PlatformName,
    confidence: best[1] >= 3 ? "high" : "low",
  };
}
