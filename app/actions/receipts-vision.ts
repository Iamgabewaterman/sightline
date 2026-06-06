"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { normalize } from "@/lib/receipt-normalizer";
import { normalizeMaterialName, fuzzyFindMatch } from "@/lib/material-normalizer";
import type { ExtractedReceiptItem, ReceiptExtractionResult } from "@/types";
import { detectCategoryFromVendor } from "@/lib/expense-category";
import { writeUserMaterialHistory } from "@/app/actions/materials";
import { computePriceFlag, savePriceFlag } from "@/lib/price-flag-utils";
import { similarity } from "@/lib/fuzzy-match";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

  // Read the file buffer BEFORE uploading — this is the canonical image data
  // Never fetch from a public URL after upload (race condition + extra latency)
  const fileBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(fileBuffer).toString("base64");

  // Validate the base64 represents a real image (a blank canvas produces ~5-10KB)
  const minExpectedLength = 5000;
  if (base64.length < minExpectedLength) {
    return { error: "Image appears blank or too small — try a clearer photo" };
  }

  // Upload to storage for record-keeping (parallel with OCR)
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${jobId}/receipts/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${ext}`;

  const uploadPromise = supabase.storage
    .from("job-photos")
    .upload(path, file, { contentType: file.type || "image/jpeg" });

  const mimeType = (
    file.type && file.type.startsWith("image/") ? file.type : "image/jpeg"
  ) as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

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
              source: {
                type: "base64",
                media_type: mimeType,
                data: base64,
              },
            },
            {
              type: "text",
              text: USER_PROMPT,
            },
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
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        // malformed JSON — proceed with empty parsed
      }
    }
  } catch {
    // Anthropic API error — proceed with empty parsed, receipt still saved
  }

  // Wait for upload to complete
  const { error: uploadError } = await uploadPromise;
  if (uploadError) return { error: uploadError.message };

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
      ocr_raw: JSON.stringify({ ...parsed, _raw_response: rawResponseText.slice(0, 500) }),
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

  const updateFields: Record<string, unknown> = { vendor };
  if (editedAmount !== undefined) updateFields.amount = editedAmount;
  if (editedDate !== undefined) updateFields.receipt_date = editedDate || null;
  await supabase.from("receipts").update(updateFields).eq("id", receiptId);

  const checkedItems = items.filter((i) => i.checked && !i.is_discount);
  const uncheckedItems = items.filter((i) => !i.checked && !i.is_discount);

  const itemsToLink = checkedItems.filter((i) => i.linked_material_id);
  const itemsToInsert = checkedItems.filter((i) => !i.linked_material_id);

  for (const item of itemsToLink) {
    await supabase.from("materials")
      .update({ receipt_id: receiptId })
      .eq("id", item.linked_material_id!);
  }

  if (itemsToInsert.length > 0) {
    // Fetch existing job materials once for consolidation matching
    const { data: existingMats } = await supabase
      .from("materials")
      .select("id, normalized_name, quantity_ordered, unit_cost, actual_quantity, actual_total_cost, reorder_count, purchase_history")
      .eq("job_id", jobId)
      .not("normalized_name", "is", null);

    // Mutable candidates list — updated as we consolidate within this batch
    const candidates = (existingMats ?? []).map((m) => ({
      id: m.id as string,
      normalizedName: m.normalized_name as string,
    }));

    const toInsert: Record<string, unknown>[] = [];
    const today = new Date().toISOString().slice(0, 10);

    for (const item of itemsToInsert) {
      const normalizedItemName = normalizeMaterialName(item.normalized_name);
      const qty = item.qty ?? 1;
      const unitCost = item.unit_price ?? null;

      const matchId = fuzzyFindMatch(normalizedItemName, candidates, 0.85);

      if (matchId) {
        const existing = (existingMats ?? []).find((m) => m.id === matchId)!;
        const existingActualQty  = Number(existing.actual_quantity  ?? existing.quantity_ordered ?? 0);
        const existingActualCost = Number(existing.actual_total_cost ?? 0);
        const existingReorders   = Number(existing.reorder_count ?? 0);
        const existingHistory    = Array.isArray(existing.purchase_history) ? existing.purchase_history : [];

        const newEntry = { date: today, quantity: qty, unit_cost: unitCost, source: "receipt" as const };
        const updateFields: Record<string, unknown> = {
          actual_quantity: existingActualQty + qty,
          reorder_count: existingReorders + 1,
          purchase_history: [...existingHistory, newEntry],
          receipt_id: receiptId,
        };
        if (unitCost !== null) {
          updateFields.actual_total_cost = existingActualCost + qty * unitCost;
        }

        await supabase.from("materials").update(updateFields).eq("id", matchId);

        // Update in-memory state so subsequent items in this batch don't re-match this one
        Object.assign(existing, updateFields);
      } else {
        const row = {
          job_id: jobId,
          name: item.normalized_name,
          unit: item.unit ?? "EA",
          quantity_ordered: qty,
          unit_cost: unitCost,
          receipt_id: receiptId,
          normalized_name: normalizedItemName,
          notes: item.raw_name !== item.normalized_name ? `Receipt: ${item.raw_name}` : null,
          baseline_quantity: qty,
          baseline_unit_cost: unitCost,
          actual_quantity: qty,
          actual_total_cost: unitCost !== null ? qty * unitCost : null,
          reorder_count: 0,
          purchase_history: [],
        };
        toInsert.push(row);
        // Add to candidates so subsequent items in this batch see it
        candidates.push({ id: `pending-${toInsert.length}`, normalizedName: normalizedItemName });
      }

      void writeUserMaterialHistory(supabase, user.id, item.normalized_name, item.unit ?? "EA", unitCost, "materials");
    }

    if (toInsert.length > 0) {
      const { error: matError } = await supabase.from("materials").insert(toInsert);
      if (matError) return { error: matError.message };
    }

    // Price flag check on newly inserted materials
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
  const { data: existingConfirmRow } = await supabase
    .from("receipt_confirmations")
    .select("id, total_confirmations")
    .eq("user_id", user.id)
    .eq("vendor_name", vendorKey)
    .maybeSingle();

  if (existingConfirmRow) {
    const newTotal = (existingConfirmRow.total_confirmations ?? 0) + 1;
    await supabase
      .from("receipt_confirmations")
      .update({ total_confirmations: newTotal, auto_confirm_enabled: newTotal >= 20 })
      .eq("id", existingConfirmRow.id);
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
