"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateProfileAvatar(avatarPath: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Use admin client to bypass RLS for the profiles write
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .upsert({ id: user.id, avatar_path: avatarPath }, { onConflict: "id" });

  if (error) return { error: error.message };
  return {};
}

export async function updateContactAvatar(
  contactId: string,
  avatarPath: string
): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("contacts")
    .update({ avatar_path: avatarPath })
    .eq("id", contactId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return {};
}
