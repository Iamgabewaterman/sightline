"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { normalize } from "@/lib/receipt-normalizer";
import { normalizeMaterialName } from "@/lib/material-normalizer";
import type { ExtractedReceiptItem, ReceiptExtractionResult } from "@/types";
import { detectCategoryFromVendor } from "@/lib/expense-category";
import { writeUserMaterialHistory } from "@/app/actions/materials";
import { computePriceFlag, savePriceFlag } from "@/lib/price-flag-utils";
import { similarity } from "@/lib/fuzzy-match";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an expert OCR system specialized in reading contractor purchase receipts from hardware stores including Home Depot, Lowes, Parr Lumber, ABC Supply, Menards, Fastenal, and SRS Distribution. You must extract data even from imperfect photos — slightly blurry, angled, hand-held, or crinkled receipts are normal in construction field conditions. Make your best effort to read every line. Never refuse to process a receipt due to photo quality — always return whatever you can extract.

Extract and return only valid JSON with no markdown and no explanation in this exact format:
{
  "vendor": "Store Name or null",
  "store_location": "City, State or store number or null",
  "date": "MM/DD/YYYY or null",
  "total": 123.45,
  "subtotal": 110.00,
  "tax": 13.45,
  "job_name": "text from Pro Xtra job field or null",
  "payment_last_four": "1234 or null",
  "line_items": [
    {
      "description": "exact text from receipt",
      "quantity": 4,
      "unit_price": 5.50,
      "total_price": 22.00,
      "category": "lumber|fasteners|tools|paint|plumbing|electrical|roofing|concrete|other",
      "sku": "item number or SKU if visible or null",
      "is_discount": false
    }
  ],
  "confidence": "high|medium|low",
  "unreadable_sections": ["section description if any part was unclear"]
}

Important extraction rules:
- Pro Xtra job name: Home Depot receipts sometimes show a JOB NAME line under the barcode or under PRO XTRA — extract it exactly as printed
- Discount lines: mark is_discount true for any line showing a savings amount, coupon, or negative price — do NOT skip these
- Quantity: can be written as 2 EA, 2x, or just 2 — extract the number only
- Partial OCR: if a word is partially readable, make your best guess and include it — do not skip the line
- confidence: high if you can read more than 90% of the receipt clearly; medium if somewhat blurry or angled but mostly readable; low if heavily damaged but you can still extract something
- Never return an empty line_items array solely because the photo is imperfect — extract whatever is visible
- Do not include payment method lines, store address lines, or thank-you footer text as line items`;

function convertDate(raw: string | null): string | null {
  if (!raw) return null;
  // MM/DD/YYYY → YYYY-MM-DD
  const mmddyyyy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyy) {
    const [, m, d, y] = mmddyyyy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // Already ISO or other — return as-is
  return raw;
}

export async function extractReceiptItems(
  jobId: string,
  formData: FormData
): Promise<{ result?: ReceiptExtractionResult; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const file = formData.get("receipt") as File;
  if (!file || file.size === 0) return { error: "No file selected" };

  // Upload to storage
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${jobId}/receipts/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("job-photos")
    .upload(path, file, { contentType: file.type || "image/jpeg" });

  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from("job-photos").getPublicUrl(path);

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
    vendor: null,
    store_location: null,
    date: null,
    total: null,
    subtotal: null,
    tax: null,
    job_name: null,
    payment_last_four: null,
    line_items: [],
    confidence: null,
    unreadable_sections: null,
  };

  try {
    const imgResp = await fetch(publicUrl);
    const imgBuffer = await imgResp.arrayBuffer();
    const base64 = Buffer.from(imgBuffer).toString("base64");
    const mimeType = (
      file.type && file.type.startsWith("image/") ? file.type : "image/jpeg"
    ) as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mimeType, data: base64 },
            },
            { type: "text", text: "Extract all data from this receipt." },
          ],
        },
      ],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
  } catch {
    // Vision failed — save receipt row, return empty result (never block user)
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
        if (score > bestScore) {
          bestScore = score;
          bestName = j.name;
        }
      }
      if (bestScore >= 0.55) suggestedJob = bestName;
    }
  }

  // Save receipt row
  const { data: receipt, error: dbError } = await supabase
    .from("receipts")
    .insert({
      job_id: jobId,
      storage_path: path,
      amount: parsed.total,
      vendor: parsed.vendor,
      receipt_date: isoDate ?? null,
      category: detectCategoryFromVendor(parsed.vendor),
      ocr_raw: JSON.stringify(parsed),
    })
    .select()
    .single();

  if (dbError) return { error: dbError.message };

  // Duplicate check (same vendor + same date on this job)
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

  // Load user preferences (auto-exclude)
  const { data: prefs } = await supabase
    .from("receipt_item_preferences")
    .select("normalized_name, auto_exclude")
    .eq("user_id", user.id);

  const excludedSet = new Set(
    (prefs ?? [])
      .filter((p) => p.auto_exclude)
      .map((p) => p.normalized_name as string)
  );

  // Auto-confirm status
  const { data: confirmRow } = await supabase
    .from("receipt_confirmations")
    .select("total_confirmations, auto_confirm_enabled")
    .eq("user_id", user.id)
    .eq("vendor_name", parsed.vendor ?? "__global__")
    .maybeSingle();

  const autoConfirm = confirmRow?.auto_confirm_enabled === true;

  // Map line_items → ExtractedReceiptItem[]
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

  return {
    result: {
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
    },
  };
}

export async function confirmReceiptItems(
  jobId: string,
  receiptId: string,
  items: ExtractedReceiptItem[],
  vendor: string | null,
  editedAmount?: number | null,
  editedDate?: string | null
): Promise<{ success?: boolean; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Update receipt with any user-edited values
  const updateFields: Record<string, unknown> = { vendor };
  if (editedAmount !== undefined) updateFields.amount = editedAmount;
  if (editedDate !== undefined) updateFields.receipt_date = editedDate || null;
  await supabase.from("receipts").update(updateFields).eq("id", receiptId);

  const checkedItems = items.filter((i) => i.checked && !i.is_discount);
  const uncheckedItems = items.filter((i) => !i.checked && !i.is_discount);

  // Items linked to existing materials — just attach receipt proof
  const itemsToLink = checkedItems.filter((i) => i.linked_material_id);
  const itemsToInsert = checkedItems.filter((i) => !i.linked_material_id);

  for (const item of itemsToLink) {
    await supabase.from("materials")
      .update({ receipt_id: receiptId })
      .eq("id", item.linked_material_id!);
  }

  if (itemsToInsert.length > 0) {
    const materialRows = itemsToInsert.map((item) => ({
      job_id: jobId,
      name: item.normalized_name,
      unit: item.unit ?? "EA",
      quantity_ordered: item.qty ?? 1,
      unit_cost: item.unit_price ?? null,
      receipt_id: receiptId,
      normalized_name: normalizeMaterialName(item.normalized_name),
      notes: item.raw_name !== item.normalized_name
        ? `Receipt: ${item.raw_name}`
        : null,
    }));

    const { error: matError } = await supabase.from("materials").insert(materialRows);
    if (matError) return { error: matError.message };

    for (const item of itemsToInsert) {
      void writeUserMaterialHistory(
        supabase,
        user.id,
        item.normalized_name,
        item.unit ?? "EA",
        item.unit_price ?? null,
        "materials",
      );
    }

    const { data: newMats } = await supabase
      .from("materials")
      .select("id, normalized_name, unit_cost, job_id")
      .eq("job_id", jobId)
      .eq("receipt_id", receiptId)
      .not("unit_cost", "is", null)
      .not("normalized_name", "is", null);

    if (newMats?.length) {
      for (const mat of newMats) {
        const flag = await computePriceFlag(
          supabase, user.id,
          mat.normalized_name as string,
          jobId,
          Number(mat.unit_cost),
        );
        if (flag) {
          void savePriceFlag(supabase, user.id, mat.id as string, jobId, flag.changePct, flag.avgCost);
        }
      }
    }
  }

  for (const item of uncheckedItems) {
    const { data: existing } = await supabase
      .from("receipt_item_preferences")
      .select("id, uncheck_count")
      .eq("user_id", user.id)
      .eq("normalized_name", item.normalized_name)
      .maybeSingle();

    if (existing) {
      const newCount = (existing.uncheck_count ?? 0) + 1;
      await supabase
        .from("receipt_item_preferences")
        .update({ uncheck_count: newCount, auto_exclude: newCount >= 3 })
        .eq("id", existing.id);
    } else {
      await supabase.from("receipt_item_preferences").insert({
        user_id: user.id,
        normalized_name: item.normalized_name,
        uncheck_count: 1,
        auto_exclude: false,
      });
    }
  }

  const vendorKey = vendor ?? "__global__";
  const { data: confirmRow } = await supabase
    .from("receipt_confirmations")
    .select("id, total_confirmations")
    .eq("user_id", user.id)
    .eq("vendor_name", vendorKey)
    .maybeSingle();

  if (confirmRow) {
    const newTotal = (confirmRow.total_confirmations ?? 0) + 1;
    await supabase
      .from("receipt_confirmations")
      .update({ total_confirmations: newTotal, auto_confirm_enabled: newTotal >= 20 })
      .eq("id", confirmRow.id);
  } else {
    await supabase.from("receipt_confirmations").insert({
      user_id: user.id,
      vendor_name: vendorKey,
      total_confirmations: 1,
      auto_confirm_enabled: false,
    });
  }

  return { success: true };
}
