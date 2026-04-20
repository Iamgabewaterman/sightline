/**
 * RFC 4180-compliant CSV parser shared by ImportWizard and MegaImportSection.
 * Handles BOM, CRLF/LF, quoted fields, and escaped quotes.
 */
export function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"' && clean[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field); field = "";
    } else if (ch === "\n") {
      row.push(field); field = "";
      if (row.some((c) => c.trim())) records.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((c) => c.trim())) records.push(row);

  if (records.length === 0) return { headers: [], rows: [] };

  const headers = records[0].map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < records.length; i++) {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = (records[i][idx] ?? "").trim(); });
    if (Object.values(obj).some((v) => v)) rows.push(obj);
  }

  return { headers, rows };
}
