import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { normalize } from "@/lib/receipt-normalizer";
import type { ExtractedReceiptItem } from "@/types";
import { detectCategoryFromVendor } from "@/lib/expense-category";
import { similarity } from "@/lib/fuzzy-match";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 60;

const SYSTEM_PROMPT = `You are a master receipt OCR specialist for construction materials. You have memorized the exact receipt format of every major building supply chain in North America. Extract every single line item with perfect accuracy. Return only valid JSON, no markdown, no preamble, no explanation.`;

const USER_PROMPT = `Analyze this receipt photo. Extract ALL line items and header info.

STORE-SPECIFIC INSTRUCTIONS:
- Home Depot: SKUs are 12-digit numbers. Look for the PRO XTRA section — extract JOB NAME as job_name. Bundle discounts appear as negative-price lines.
- Lowe's: SKUs are 6-digit item numbers. PRO account job names may appear at top or bottom of receipt.
- Parr Lumber: Lumber shows species+grade+dimensions (e.g. "2x4x8 SPF #2"). Multiple lines when breaking a bundle.
- ABC Supply: Roofing items show manufacturer + product code. Look for delivery ticket numbers near the top.
- SRS Distribution: Similar to ABC — roofing manufacturer codes, bundle quantities, delivery ticket.
- Menards: 6–8 digit store SKUs. Rebate stickers are separate lines — mark as is_discount true.
- Fastenal: Part number + description format. Box quantities common (e.g. "BX100", "PK50").

QUANTITY FORMAT HANDLING — parse all of these correctly:
- "3 AT $24.99 EA" → quantity: 3, unit_price: 24.99, total_price: 74.97
- "2 @ $15.00" → quantity: 2, unit_price: 15.00
- "4 X $8.50" → quantity: 4, unit_price: 8.50
- "QTY 6  $3.25" → quantity: 6, unit_price: 3.25
- If a printed total doesn't match quantity × unit_price math, trust the printed total

HANDWRITING: If any section is handwritten, extract your best estimate and describe it in unreadable_sections (e.g. "handwritten qty on line 3").

CATEGORIES — use exactly one of these values per item:
lumber | sheet_goods | roofing | concrete | plumbing | electrical | fasteners | insulation | drywall | paint | flooring | siding | tools | other

Return this exact JSON with no markdown fences:
{
  "vendor": "store name or null",
  "store_location": "city and state or store number or null",
  "date": "MM/DD/YYYY or null",
  "total": 123.45,
  "subtotal": 110.00,
  "tax": 13.45,
  "job_name": "job name from PRO XTRA or other job reference field or null",
  "payment_last_four": "last 4 digits or null",
  "line_items": [
    {
      "description": "item description exactly as printed",
      "quantity": 1,
      "unit_price": 9.99,
      "total_price": 9.99,
      "category": "lumber or sheet_goods or roofing or concrete or plumbing or electrical or fasteners or insulation or drywall or paint or flooring or siding or tools or other",
      "sku": "item number if visible or null",
      "is_discount": false
    }
  ],
  "confidence": "high or medium or low",
  "unreadable_sections": ["describe any sections that could not be read clearly"]
}

CRITICAL RULES:
- Never return an empty line_items array when purchases are visible
- The itemized section is between the store header and the subtotal — every product row is a line item
- Mark coupon discounts, store credits, and savings lines as is_discount: true with negative total_price
- If a number is unclear, use your best estimate based on surrounding context (nearby totals, typical pricing)
- Include every item — do not skip items because they seem minor or cheap`;

function convertDate(raw: string | null): string | null {
  if (!raw) return null;
  const mmddyyyy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyy) {
    const [, m, d, y] = mmddyyyy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return raw;
}

// GET — health check so the route is verifiable without uploading a receipt
export async function GET() {
  return Response.json({ ok: true, service: "receipts-vision" });
}

export async function POST(request: Request) {
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  function send(event: string, data: Record<string, unknown>) {
    const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    writer.write(encoder.encode(chunk)).catch(() => {});
  }

  (async () => {
    try {
      if (!process.env.ANTHROPIC_API_KEY) {
        console.error("[receipts-vision] ANTHROPIC_API_KEY is not configured");
        send("error", { error: "API key not configured" });
        return;
      }

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        send("error", { error: "Not authenticated" });
        return;
      }

      let formData: FormData;
      try {
        formData = await request.formData();
      } catch {
        send("error", { error: "Invalid form data" });
        return;
      }

      const jobId = formData.get("jobId") as string;
      const file = formData.get("receipt") as File | null;

      if (!jobId) { send("error", { error: "jobId is required" }); return; }
      if (!file || file.size === 0) {
        console.error("[receipts-vision] No file received. formData keys:", Array.from(formData.keys()));
        send("error", { error: "No image received" });
        return;
      }

      // Milestone 1 — immediate feedback
      send("progress", { step: "received", message: "Photo received — analyzing your receipt" });

      const mimeType = (
        file.type && file.type.startsWith("image/") ? file.type : "image/jpeg"
      ) as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

      const fileBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(fileBuffer).toString("base64");

      const ext = file.name.split(".").pop() || "jpg";
      const storagePath = `${jobId}/receipts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const uploadPromise = supabase.storage
        .from("job-photos")
        .upload(storagePath, file, { contentType: file.type || "image/jpeg" });

      // Milestone 2 — before Anthropic call
      send("progress", { step: "extracting", message: "Extracting line items" });

      type ParsedReceipt = {
        vendor: string | null;
        store_location: string | null;
        date: string | null;
        total: number | null;
        subtotal: number | null;
        tax: number | null;
        job_name: string | null;
        payment_last_four: string | null;
        line_items: Array<{
          description: string;
          quantity: number | null;
          unit_price: number | null;
          total_price: number | null;
          category: string | null;
          sku: string | null;
          is_discount: boolean;
        }>;
        confidence: "high" | "medium" | "low" | null;
        unreadable_sections: string[] | null;
      };

      let parsed: ParsedReceipt = {
        vendor: null, store_location: null, date: null, total: null,
        subtotal: null, tax: null, job_name: null, payment_last_four: null,
        line_items: [], confidence: null, unreadable_sections: null,
      };

      let rawResponseText = "";

      try {
        const msg = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: { type: "base64", media_type: mimeType, data: base64 },
                },
                { type: "text", text: USER_PROMPT },
              ],
            },
          ],
        });

        rawResponseText = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";

        const cleaned = rawResponseText
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/\s*```$/i, "")
          .trim();

        const match = cleaned.match(/\{[\s\S]*\}/);
        if (!match) {
          console.error("[receipts-vision] No JSON object found in Anthropic response. Full response:", rawResponseText.slice(0, 500));
        } else {
          try {
            parsed = JSON.parse(match[0]);
          } catch (parseErr) {
            console.error("[receipts-vision] JSON.parse failed:", parseErr, "| matched text:", match[0].slice(0, 200));
          }
        }
      } catch (err: unknown) {
        const e = err as { message?: string; status?: number; error?: unknown };
        console.error("[receipts-vision] Anthropic API error:", { message: e?.message, status: e?.status, error: e?.error, raw: String(err) });
        send("error", { error: `Anthropic API error: ${e?.message ?? String(err)}` });
        return;
      }

      // Milestone 3 — OCR done, now organizing
      send("progress", { step: "organizing", message: "Organizing materials" });

      // Wait for upload
      const { error: uploadError } = await uploadPromise;
      if (uploadError) {
        send("error", { error: uploadError.message });
        return;
      }

      const isoDate = convertDate(parsed.date);

      // Milestone 4 — checking against job
      send("progress", { step: "checking", message: "Checking against your job" });

      // Fuzzy-match Pro Xtra job_name against user's active jobs
      let suggestedJob: string | null = null;
      if (parsed.job_name) {
        const { data: activeJobs } = await supabase
          .from("jobs")
          .select("name")
          .eq("user_id", user.id)
          .eq("status", "active");
        if (activeJobs?.length) {
          let bestScore = 0;
          let bestName: string | null = null;
          for (const j of activeJobs) {
            const score = similarity(parsed.job_name, j.name);
            if (score > bestScore) { bestScore = score; bestName = j.name; }
          }
          if (bestScore >= 0.55) suggestedJob = bestName;
        }
      }

      // Save receipt row
      const { data: receipt, error: dbError } = await supabase
        .from("receipts")
        .insert({
          job_id: jobId,
          storage_path: storagePath,
          amount: parsed.total,
          vendor: parsed.vendor,
          receipt_date: isoDate ?? null,
          category: detectCategoryFromVendor(parsed.vendor),
          ocr_raw: JSON.stringify({ ...parsed, _raw_response: rawResponseText.slice(0, 500) }),
        })
        .select()
        .single();

      if (dbError) {
        send("error", { error: dbError.message });
        return;
      }

      // Duplicate check
      let duplicateReceipt = null;
      if (parsed.vendor && isoDate) {
        const { data: existingDup } = await supabase
          .from("receipts")
          .select("id, vendor, amount, receipt_date")
          .eq("job_id", jobId)
          .eq("vendor", parsed.vendor)
          .eq("receipt_date", isoDate)
          .neq("id", receipt!.id)
          .limit(1)
          .maybeSingle();
        if (existingDup) duplicateReceipt = existingDup;
      }

      const [{ data: prefs }, { data: confirmRow }] = await Promise.all([
        supabase.from("receipt_item_preferences").select("normalized_name, auto_exclude").eq("user_id", user.id),
        supabase.from("receipt_confirmations").select("total_confirmations, auto_confirm_enabled")
          .eq("user_id", user.id)
          .eq("vendor_name", parsed.vendor ?? "__global__")
          .maybeSingle(),
      ]);

      const excludedSet = new Set(
        (prefs ?? []).filter((p) => p.auto_exclude).map((p) => p.normalized_name as string)
      );
      const autoConfirm = confirmRow?.auto_confirm_enabled === true;

      const items: ExtractedReceiptItem[] = (parsed.line_items ?? []).map((item) => {
        const rawName = item.description ?? "";
        const normalizedName = normalize(rawName);
        return {
          raw_name: rawName,
          normalized_name: normalizedName,
          qty: item.quantity,
          unit: null,
          unit_price: item.unit_price,
          line_total: item.total_price,
          checked: !excludedSet.has(normalizedName) && !item.is_discount,
          category: item.category ?? null,
          sku: item.sku ?? null,
          is_discount: item.is_discount ?? false,
        };
      });

      const result = {
        receipt_id: receipt!.id,
        vendor: parsed.vendor,
        receipt_date: isoDate,
        items,
        total: parsed.total,
        image_unclear: false,
        auto_confirm: autoConfirm,
        duplicate_receipt: duplicateReceipt ?? null,
        store_location: parsed.store_location ?? null,
        subtotal: parsed.subtotal ?? null,
        tax: parsed.tax ?? null,
        confidence: parsed.confidence ?? null,
        job_name: parsed.job_name ?? null,
        suggested_job: suggestedJob,
        unreadable_sections: parsed.unreadable_sections ?? null,
      };

      // Milestone 5 — done
      send("complete", { result });

    } catch (err: unknown) {
      const e = err as { message?: string };
      console.error("[receipts-vision] Unexpected error:", e);
      send("error", { error: `Unexpected error: ${e?.message ?? String(err)}` });
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
