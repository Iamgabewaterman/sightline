"use server";

import Anthropic from "@anthropic-ai/sdk";
import { MegaImportType } from "@/lib/detect-file-type";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PDF_EXTRACT_PROMPT = `You are extracting structured data from a contractor's business document.

This document may be an export from QuickBooks, Jobber, Leap CRM, JobNimbus, AccuLynx, ServiceTitan, Buildertrend, Houzz Pro, or a generic invoice/estimate/receipt.

Analyze the document and return ONLY valid JSON in this exact structure:
{
  "detected_type": "clients|jobs|materials|labor|expenses|contacts|unknown",
  "platform": "QuickBooks|Jobber|Leap|JobNimbus|AccuLynx|ServiceTitan|Buildertrend|HouzzPro|generic",
  "rows": [
    { "column1": "value1", "column2": "value2", ... }
  ],
  "headers": ["column1", "column2", ...]
}

Detection rules:
- "clients": customer names, emails, phone numbers, addresses, homeowners
- "jobs": project names, job addresses, statuses, work orders, opportunities, claim numbers
- "materials": material names, quantities, unit costs, parts, product descriptions
- "labor": crew names, hours worked, pay rates, technician time, duration logs
- "expenses": vendor names, amounts, dates, transaction types, receipts
- "contacts": subcontractors, crew members, people with trades/rates

Platform detection hints:
- QuickBooks: "Transaction Type", "Split", "Memo", "Debit", "Credit", "Account"
- Jobber: "Job Number", "Job Title", "On-Site Contact", "Assigned To", "Visit"
- Leap: "Opportunity", "Adjuster", "Insurance Claim", "Claim Number", "Lead Source", "Salesperson"
- JobNimbus: "Board", "Column", "Primary Contact", "Assignees", "Job Board"
- AccuLynx: "Work Order", "Contingency", "Supplement", "Deductible", "Mortgage"
- ServiceTitan: "Customer Since", "Business Unit", "Tag Name", "Technician", "Dispatch"
- Buildertrend: "Project Manager", "Allowance", "Change Order", "Lien Waiver"
- HouzzPro: "Houzz Project ID", "Project Stage", "Request Source", "Budget Range"

Column naming — use these standardized names in output:
- For clients:   name, company, email, phone, address, notes
- For jobs:      name, address, status, types, notes, start_date, completed_date, job_number, insurance_claim, client_name
- For materials: name, unit, quantity_ordered, quantity_used, unit_cost, notes, job_name
- For labor:     crew_name, hours, rate, trade, notes, job_name, date
- For expenses:  vendor, amount, date, category, notes, job_name
- For contacts:  name, phone, trade, hourly_rate, is_subcontractor, notes

Insurance/claim handling: if you see adjuster name, claim number, or insurance claim fields, set insurance_claim=true and put adjuster info in notes.

Extract every record you can find. Use empty string for missing values (not null). Return at most 500 rows.
Do not include header rows as data rows.
Return ONLY the JSON object — no markdown, no explanation.`;

export async function extractPdfAsRows(base64Data: string): Promise<{
  detectedType: MegaImportType;
  platform: string;
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
    if (!match) return { detectedType: "unknown", platform: "generic", rows: [], headers: [], error: "Could not parse PDF content" };

    const parsed = JSON.parse(match[0]);
    const detectedType = (parsed.detected_type as MegaImportType) ?? "unknown";
    const platform: string = parsed.platform ?? "generic";
    const rows: Record<string, string>[] = (parsed.rows ?? []).map((r: Record<string, unknown>) =>
      Object.fromEntries(
        Object.entries(r).map(([k, v]) => [k, v == null ? "" : String(v)])
      )
    );
    const headers: string[] = parsed.headers ?? (rows.length > 0 ? Object.keys(rows[0]) : []);

    return { detectedType, platform, rows, headers };
  } catch (err) {
    return { detectedType: "unknown", platform: "generic", rows: [], headers: [], error: String(err) };
  }
}
