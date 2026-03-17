"use server";

import { createClient } from "@/lib/supabase/server";

export async function deletePhoto(
  photoId: string,
  storagePath: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  await supabase.storage.from("job-photos").remove([storagePath]);
  const { error } = await supabase.from("photos").delete().eq("id", photoId);
  if (error) return { error: error.message };
  return { success: true };
}
