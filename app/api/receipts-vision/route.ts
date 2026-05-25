import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { normalize } from "@/lib/receipt-normalizer";
import { normalizeMaterialName } from "@/lib/material-normalizer";
import type { ExtractedReceiptItem } from "@/types";
import { detectCategoryFromVendor } from "@/lib/expense-category";
import { similarity } from "@/lib/fuzzy-match";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 60;

const SYSTEM_PROMPT = `You are a receipt OCR specialist. Extract every line item from this receipt photo. Return only JSON, no other text.`;

const USER_PROMPT = `This is a receipt photo from a hardware store. Extract ALL line items visible. For each item extract the description, quantity, unit price, and total price. Also extract the store name, date, grand total, store location, and any job name or PO number shown (look for PRO XTRA JOB NAME field on Home Depot receipts).

Return this exact JSON structure with no markdown fences, no explanation, just the raw JSON object:
{
  "vendor": "store name or null",
  "store_location": "city and state or store number or null",
  "date": "MM/DD/YYYY or null",
  "total": 123.45,
  "subtotal": 110.00,
  "tax": 13.45,
  "job_name": "job name from PRO XTRA section or null",
  "payment_last_four": "last 4 digits or null",
  "line_items": [
    {
      "description": "item description exactly as printed",
      "quantity": 1,
      "unit_price": 9.99,
      "total_price": 9.99,
      "category": "lumber or fasteners or tools or paint or plumbing or electrical or roofing or concrete or other",
      "sku": "item number if visible or null",
      "is_discount": false
    }
  ],
  "confidence": "high or medium or low",
  "unreadable_sections": []
}

If you cannot read a value clearly make your best estimate based on context. Never return an empty line_items array if there are visible purchases on the receipt. Look for the itemized section between the store header and the subtotal line — every row in that section is a line item. Mark savings lines and coupon lines as is_discount true.`;

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
  return NextResponse.json({ ok: true, service: "receipts-vision" });
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("[receipts-vision] ANTHROPIC_API_KEY is not configured");
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const jobId = formData.get("jobId") as string;
  const file = formData.get("receipt") as File | null;

  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }
  if (!file || file.size === 0) {
    console.error("[receipts-vision] No file received. formData keys:", Array.from(formData.keys()));
    return NextResponse.json({ error: "No image received" }, { status: 400 });
  }

  const mimeType = (
    file.type && file.type.startsWith("image/") ? file.type : "image/jpeg"
  ) as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

  // Read buffer BEFORE uploading — guaranteed to be the actual image bytes
  const fileBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(fileBuffer).toString("base64");
  console.error("[receipts-vision] base64 length:", base64.length, "| mimeType:", mimeType, "| fileSize:", file.size, "| fileName:", file.name);
  if (base64.length < 1000) {
    console.error("[receipts-vision] WARNING: base64 is suspiciously short — image may not have been read correctly");
  }

  // Upload to storage and run OCR in parallel
  const ext = file.name.split(".").pop() || "jpg";
  const storagePath = `${jobId}/receipts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const uploadPromise = supabase.storage
    .from("job-photos")
    .upload(storagePath, file, { contentType: file.type || "image/jpeg" });

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

  console.error("[receipts-vision] sending to Anthropic — model: claude-sonnet-4-6, max_tokens: 4096, image mediaType:", mimeType, "base64Chars:", base64.length);

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
    console.error("[receipts-vision] Anthropic responded, rawText length:", rawResponseText.length, "| first 200 chars:", rawResponseText.slice(0, 200));

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
        console.error("[receipts-vision] Parsed OK — line_items count:", parsed.line_items?.length ?? 0, "vendor:", parsed.vendor, "total:", parsed.total);
      } catch (parseErr) {
        console.error("[receipts-vision] JSON.parse failed:", parseErr, "| matched text:", match[0].slice(0, 200));
      }
    }
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number; error?: unknown };
    console.error("[receipts-vision] Anthropic API error:", { message: e?.message, status: e?.status, error: e?.error, raw: String(err) });
    return NextResponse.json({ error: `Anthropic API error: ${e?.message ?? String(err)}` }, { status: 500 });
  }

  // Wait for upload
  const { error: uploadError } = await uploadPromise;
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const isoDate = convertDate(parsed.date);

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
    return NextResponse.json({ error: dbError.message }, { status: 500 });
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

  return NextResponse.json({ result });
}
