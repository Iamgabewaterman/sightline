// Currency, date, and phone normalization for multi-platform imports

export function normalizeCurrency(raw: string): number | null {
  if (!raw) return null;
  // Strip currency symbols, codes, commas, spaces: "$1,234.56", "USD 1234.56", "1.234,56" (EU)
  let cleaned = raw.trim().replace(/^[A-Z]{3}\s*/i, "").replace(/[$£€¥]/g, "").replace(/\s/g, "");
  // Handle European decimal format (1.234,56 → 1234.56)
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    cleaned = cleaned.replace(/,/g, "");
  }
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

export function normalizeDate(raw: string): string {
  if (!raw) return new Date().toISOString().slice(0, 10);
  const s = raw.trim();
  // ISO: 2024-01-15
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // MM/DD/YYYY or M/D/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  // DD/MM/YYYY (European — only when day > 12)
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy && parseInt(dmy[1]) > 12) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  // Month DD, YYYY or DD Month YYYY
  const monthName = s.match(/(\w+ \d{1,2},? \d{4}|\d{1,2} \w+ \d{4})/);
  if (monthName) {
    const d = new Date(monthName[0]);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  // Native parse fallback
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
}

export function normalizePhone(raw: string): string {
  if (!raw) return "";
  // Strip everything except digits and leading +
  const digits = raw.trim().replace(/[^\d+]/g, "");
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith("1")) {
    const d = digits.slice(1);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return raw.trim(); // international or non-standard — return as-is
}
