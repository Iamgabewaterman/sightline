"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { normalize } from "@/lib/receipt-normalizer";
import type { ExtractedReceiptItem, ReceiptExtractionResult } from "@/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VISION_PROMPT = `You are analyzing a contractor's material purchase receipt.
Extract every line item visible on the receipt.

Return ONLY valid JSON in this exact structure (no markdown, no explanation):
{
  "vendor": "Store Name or null",
  "date": "YYYY-MM-DD or null",
  "total": 123.45,
  "image_unclear": false,
  "items": [
    {
      "raw_name": "exact text from receipt",
      "qty": 4,
      "unit": "EA",
      "unit_price": 5.50,
      "line_total": 22.00
    }
  ]
}

Rules:
- raw_name: copy the text exactly as printed, abbreviations and all
- qty: number only, null if not shown
- unit: EA, LF, SF, SQ, BDL, GAL, etc. — null if not shown
- unit_price and line_total: numbers only, no dollar signs, null if not shown
- If the image is blurry or unreadable, set image_unclear to true and items to []
- Do not include tax lines, subtotals, or payment method lines as items`;

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

  // Get base64 for vision
  const {
    data: { publicUrl },
  } = supabase.storage.from("job-photos").getPublicUrl(path);

  let parsed: {
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
  } = { vendor: null, date: null, total: null, image_unclear: false, items: [] };

  try {
    const imgResp = await fetch(publicUrl);
    const imgBuffer = await imgResp.arrayBuffer();
    const base64 = Buffer.from(imgBuffer).toString("base64");
    const mimeType = (
      file.type && file.type.startsWith("image/") ? file.type : "image/jpeg"
    ) as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mimeType, data: base64 },
            },
            { type: "text", text: VISION_PROMPT },
          ],
        },
      ],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
  } catch {
    // Vision failed — save receipt anyway, return image_unclear
    const { data: receipt } = await supabase
      .from("receipts")
      .insert({ job_id: jobId, storage_path: path, amount: null, vendor: null, ocr_raw: null })
      .select()
      .single();

    return {
      result: {
        receipt_id: receipt?.id ?? "",
        vendor: null,
        receipt_date: null,
        items: [],
        total: null,
        image_unclear: true,
        auto_confirm: false,
      },
    };
  }

  if (parsed.image_unclear) {
    const { data: receipt } = await supabase
      .from("receipts")
      .insert({ job_id: jobId, storage_path: path, amount: null, vendor: null, ocr_raw: null })
      .select()
      .single();

    return {
      result: {
        receipt_id: receipt?.id ?? "",
        vendor: parsed.vendor,
        receipt_date: parsed.date,
        items: [],
        total: null,
        image_unclear: true,
        auto_confirm: false,
      },
    };
  }

  // Save receipt row (we'll update amount/vendor after confirmation)
  const { data: receipt, error: dbError } = await supabase
    .from("receipts")
    .insert({
      job_id: jobId,
      storage_path: path,
      amount: parsed.total,
      vendor: parsed.vendor,
      ocr_raw: JSON.stringify(parsed),
    })
    .select()
    .single();

  if (dbError) return { error: dbError.message };

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

  // Check auto-confirm status
  const { data: confirmRow } = await supabase
    .from("receipt_confirmations")
    .select("total_confirmations, auto_confirm_enabled")
    .eq("user_id", user.id)
    .eq("vendor_name", parsed.vendor ?? "__global__")
    .maybeSingle();

  const autoConfirm = confirmRow?.auto_confirm_enabled === true;

  // Build items with normalization + checked state
  const items: ExtractedReceiptItem[] = (parsed.items ?? []).map((item) => {
    const normalizedName = normalize(item.raw_name);
    return {
      raw_name: item.raw_name,
      normalized_name: normalizedName,
      qty: item.qty,
      unit: item.unit,
      unit_price: item.unit_price,
      line_total: item.line_total,
      checked: !excludedSet.has(normalizedName),
    };
  });

  return {
    result: {
      receipt_id: receipt!.id,
      vendor: parsed.vendor,
      receipt_date: parsed.date,
      items,
      total: parsed.total,
      image_unclear: false,
      auto_confirm: autoConfirm,
    },
  };
}

export async function confirmReceiptItems(
  jobId: string,
  receiptId: string,
  items: ExtractedReceiptItem[],
  vendor: string | null
): Promise<{ success?: boolean; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const checkedItems = items.filter((i) => i.checked);
  const uncheckedItems = items.filter((i) => !i.checked);

  // Create material entries for checked items
  if (checkedItems.length > 0) {
    const materialRows = checkedItems.map((item) => ({
      job_id: jobId,
      name: item.normalized_name,
      unit: item.unit ?? "EA",
      quantity_ordered: item.qty ?? 1,
      unit_cost: item.unit_price ?? null,
      notes: item.raw_name !== item.normalized_name
        ? `Receipt: ${item.raw_name}`
        : null,
    }));

    const { error: matError } = await supabase.from("materials").insert(materialRows);
    if (matError) return { error: matError.message };
  }

  // Update uncheck counts and auto-exclude flags
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

  // Increment confirmation count; enable auto-confirm at 20
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
