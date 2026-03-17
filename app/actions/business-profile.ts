"use server";

import { createClient } from "@/lib/supabase/server";
import { BusinessProfile } from "@/types";

export async function getBusinessProfile(): Promise<BusinessProfile | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<BusinessProfile>();
  return data;
}

export async function upsertBusinessProfile(
  fields: Partial<Omit<BusinessProfile, "id" | "user_id" | "created_at">>
): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { error } = await supabase
    .from("business_profiles")
    .upsert({ user_id: user.id, ...fields }, { onConflict: "user_id" });
  if (error) return { error: error.message };
  return {};
}

export async function uploadBusinessLogo(file: File): Promise<{ path?: string; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const ext = file.name.split(".").pop();
  const path = `${user.id}/logo.${ext}`;
  const { error } = await supabase.storage
    .from("business-logos")
    .upload(path, file, { upsert: true });
  if (error) return { error: error.message };
  return { path };
}
