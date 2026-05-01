"use server";

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PROMPT = `You are analyzing a contractor's material purchase receipt.

Extract every line item visible on the receipt.

Return ONLY valid JSON (no markdown, no explanation):
{
  "vendor": "Store Name or null",
  "date": "YYYY-MM-DD or null",
  "total": 123.45,
  "image_unclear": false,
  "items": [
    { "raw_name": "exact text", "qty": 4, "unit": "EA", "unit_price": 5.50, "line_total": 22.00 }
  ]
}

Rules:
- vendor: full store name including location/number
- total: grand total after tax, not subtotal
- raw_name: copy description exactly as printed
- qty/unit/unit_price/line_total: null if not visible
- image_unclear: true if blurry or unreadable
- Do NOT include tax lines, subtotals, delivery fees, or payment method lines`;

export interface DemoOCRResult {
  vendor: string | null;
  date: string | null;
  total: number | null;
  image_unclear: boolean;
  items: Array<{
    raw_name: string;
    qty: number | null;
    unit: string | null;
    unit_price: number | null;
    line_total: number | null;
  }>;
  error?: string;
}

export async function demoReceiptOCR(base64Image: string, mimeType: string): Promise<DemoOCRResult> {
  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mimeType as "image/jpeg" | "image/png" | "image/webp", data: base64Image },
          },
          { type: "text", text: PROMPT },
        ],
      }],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { vendor: null, date: null, total: null, image_unclear: true, items: [], error: "Could not parse response" };

    const parsed = JSON.parse(match[0]);
    return {
      vendor: parsed.vendor ?? null,
      date: parsed.date ?? null,
      total: typeof parsed.total === "number" ? parsed.total : null,
      image_unclear: parsed.image_unclear ?? false,
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch (err) {
    return { vendor: null, date: null, total: null, image_unclear: false, items: [], error: String(err) };
  }
}
