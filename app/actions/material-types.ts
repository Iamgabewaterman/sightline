"use server";

import { createClient } from "@/lib/supabase/server";
import { MaterialType, MaterialBrand, MaterialColor } from "@/types";
import { parseAddress } from "@/lib/address-parser";

export async function getMaterialTypes(): Promise<MaterialType[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("material_types")
    .select("*")
    .order("category")
    .order("name");
  return (data ?? []) as MaterialType[];
}

export async function getBrandsForType(typeId: string): Promise<MaterialBrand[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("material_brands")
    .select("*")
    .eq("material_type_id", typeId)
    .order("is_verified", { ascending: false })
    .order("brand_name");
  return (data ?? []) as MaterialBrand[];
}

export async function getColorsForBrand(
  typeId: string,
  brandId?: string | null,
): Promise<MaterialColor[]> {
  const supabase = createClient();
  let query = supabase
    .from("material_colors")
    .select("*")
    .eq("material_type_id", typeId)
    .order("is_verified", { ascending: false })
    .order("color_name");

  if (brandId) {
    query = query.eq("material_brand_id", brandId);
  }

  const { data } = await query;
  return (data ?? []) as MaterialColor[];
}

export async function addBrand(
  typeId: string,
  brandName: string,
): Promise<{ brand?: MaterialBrand; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: bp } = await supabase
    .from("business_profiles")
    .select("address")
    .eq("user_id", user.id)
    .maybeSingle();

  const { zip } = parseAddress(bp?.address ?? "");

  // Check if brand already exists
  const { data: existing } = await supabase
    .from("material_brands")
    .select("id, vote_count, is_verified")
    .eq("material_type_id", typeId)
    .ilike("brand_name", brandName.trim())
    .maybeSingle();

  if (existing) {
    // Brand exists — increment vote count and auto-verify if threshold met
    const newVoteCount = (existing.vote_count ?? 1) + 1;
    const shouldVerify = !existing.is_verified && newVoteCount >= 3;
    await supabase
      .from("material_brands")
      .update({
        vote_count: newVoteCount,
        ...(shouldVerify ? { is_verified: true } : {}),
      })
      .eq("id", existing.id);
    // Return the updated brand
    const { data: updated } = await supabase
      .from("material_brands")
      .select("*")
      .eq("id", existing.id)
      .single();
    return { brand: updated as MaterialBrand };
  }

  const { data, error } = await supabase
    .from("material_brands")
    .insert({
      material_type_id: typeId,
      brand_name: brandName.trim(),
      is_verified: false,
      added_by_user_id: user.id,
      region: zip ?? null,
      vote_count: 1,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return { error: "Brand already exists" };
    return { error: error.message };
  }

  return { brand: data as MaterialBrand };
}

export async function addColor(
  typeId: string,
  brandId: string | null,
  colorName: string,
): Promise<{ color?: MaterialColor; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Check for existing (case-insensitive)
  let existingQuery = supabase
    .from("material_colors")
    .select("id, is_verified")
    .eq("material_type_id", typeId)
    .ilike("color_name", colorName.trim());

  if (brandId) existingQuery = existingQuery.eq("material_brand_id", brandId);

  const { data: existing } = await existingQuery.maybeSingle();

  if (existing) {
    const { data: full } = await supabase
      .from("material_colors")
      .select("*")
      .eq("id", existing.id)
      .single();
    return { color: full as MaterialColor };
  }

  const { data, error } = await supabase
    .from("material_colors")
    .insert({
      material_type_id: typeId,
      material_brand_id: brandId,
      color_name: colorName.trim(),
      is_verified: false,
      added_by_user_id: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { color: data as MaterialColor };
}
