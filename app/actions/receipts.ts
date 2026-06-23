"use server";

import { createClient } from "@/lib/supabase/server";
import { ExpenseCategory } from "@/types";

// NOTE: Receipt photo OCR lives in app/api/receipts-vision/route.ts (the
// streaming Claude vision pipeline). The old uploadReceipt() server action was a
// duplicate, lower-quality path with no callers and has been removed.

export async function updateReceiptCategory(
  id: string,
  category: ExpenseCategory
): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // RLS scopes receipts to the owning user's jobs; the auth check is defense-in-depth.
  const { error } = await supabase
    .from("receipts")
    .update({ category })
    .eq("id", id);
  if (error) return { error: error.message };
  return {};
}

export async function deleteReceipt(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Get storage_path before deleting so we can remove from storage too
  const { data: receipt } = await supabase
    .from("receipts")
    .select("storage_path")
    .eq("id", id)
    .single();
  if (receipt?.storage_path) {
    await supabase.storage.from("job-photos").remove([receipt.storage_path]);
  }
  const { error } = await supabase.from("receipts").delete().eq("id", id);
  if (error) return { error: error.message };
  return { success: true };
}
