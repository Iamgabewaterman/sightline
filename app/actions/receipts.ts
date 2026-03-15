"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { Receipt } from "@/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function uploadReceipt(
  jobId: string,
  formData: FormData
): Promise<{ receipt?: Receipt; error?: string }> {
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

  // Run OCR with Claude
  const {
    data: { publicUrl },
  } = supabase.storage.from("job-photos").getPublicUrl(path);

  let amount: number | null = null;
  let vendor: string | null = null;
  let ocrRaw: string | null = null;

  try {
    const imgResp = await fetch(publicUrl);
    const imgBuffer = await imgResp.arrayBuffer();
    const base64 = Buffer.from(imgBuffer).toString("base64");
    const mimeType = (
      file.type && file.type.startsWith("image/") ? file.type : "image/jpeg"
    ) as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mimeType, data: base64 },
            },
            {
              type: "text",
              text: 'Extract the total amount and store name from this receipt. Respond with only valid JSON: {"total": 123.45, "vendor": "Store Name"}. If you cannot determine the total, use null for that field.',
            },
          ],
        },
      ],
    });

    const raw =
      msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
    ocrRaw = raw;
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      amount = parsed.total != null ? Number(parsed.total) : null;
      vendor = parsed.vendor ?? null;
    }
  } catch {
    // OCR failed — still save the receipt without extracted data
  }

  const { data: receipt, error: dbError } = await supabase
    .from("receipts")
    .insert({ job_id: jobId, storage_path: path, amount, vendor, ocr_raw: ocrRaw })
    .select()
    .single<Receipt>();

  if (dbError) return { error: dbError.message };
  return { receipt: receipt! };
}

export async function deleteReceipt(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = createClient();
  const { error } = await supabase.from("receipts").delete().eq("id", id);
  if (error) return { error: error.message };
  return { success: true };
}
