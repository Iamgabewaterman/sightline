"use server";

import { createClient } from "@/lib/supabase/server";

export async function upsertLineItemLabels(labels: string[]): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  for (const label of labels) {
    const trimmed = label.trim();
    if (!trimmed) continue;
    await supabase.rpc("increment_line_item_label", {
      p_user_id: user.id,
      p_label: trimmed,
    });
  }
}
