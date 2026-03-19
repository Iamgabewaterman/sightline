"use server";

import { createClient } from "@/lib/supabase/server";

export async function deleteDocument(id: string, storagePath: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error: dbError } = await supabase
    .from("documents")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (dbError) return { error: dbError.message };

  await supabase.storage.from("job-documents").remove([storagePath]);
  return {};
}
