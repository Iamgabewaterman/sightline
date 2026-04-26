"use server";

import Anthropic from "@anthropic-ai/sdk";
import { MegaImportType } from "@/lib/detect-file-type";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PDF_EXTRACT_PROMPT = `You are extracting structured data from a contractor's business document.
This could be a QuickBooks export, an invoice, an estimate, a time report, or an expense report.

Analyze the document and return ONLY valid JSON in this exact structure:
{
  "detected_type": "clients|jobs|materials|labor|expenses|contacts|unknown",
  "rows": [
    { "column1": "value1", "column2": "value2", ... }
  ],
  "headers": ["column1", "column2", ...]
}

Detection rules:
- "clients": customer names, emails, phone numbers, addresses
- "jobs": project names, job addresses, statuses, dates
- "materials": material names, quantities, unit costs, descriptions
- "labor": crew names, hours worked, pay rates, dates
- "expenses": vendor names, amounts, dates, categories
- "contacts": people with trades, hourly rates, phone numbers

Column naming conventions:
- For clients: name, company, email, phone, address
- For jobs: name, address, status, types, notes, start_date, completed_date
- For materials: name, unit, quantity_ordered, quantity_used, unit_cost, notes
- For labor: crew_name, hours, rate, category, notes
- For expenses: vendor, amount, date, category, notes
- For contacts: name, phone, trade, hourly_rate, notes

Extract every record you can find. Use null for missing values. Return at most 500 rows.
Do not include header rows as data rows.`;

export async function extractPdfAsRows(base64Data: string): Promise<{
  detectedType: MegaImportType;
  rows: Record<string, string>[];
  headers: string[];
  error?: string;
}> {
  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: [
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64Data,
              },
            } as any,
            { type: "text", text: PDF_EXTRACT_PROMPT },
          ],
        },
      ],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { detectedType: "unknown", rows: [], headers: [], error: "Could not parse PDF content" };

    const parsed = JSON.parse(match[0]);
    const detectedType = (parsed.detected_type as MegaImportType) ?? "unknown";
    const rows: Record<string, string>[] = (parsed.rows ?? []).map((r: Record<string, unknown>) =>
      Object.fromEntries(
        Object.entries(r).map(([k, v]) => [k, v == null ? "" : String(v)])
      )
    );
    const headers: string[] = parsed.headers ?? (rows.length > 0 ? Object.keys(rows[0]) : []);

    return { detectedType, rows, headers };
  } catch (err) {
    return { detectedType: "unknown", rows: [], headers: [], error: String(err) };
  }
}
