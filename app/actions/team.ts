"use server";

import { createClient } from "@/lib/supabase/server";
import { Profile, Company } from "@/types";

// ── Invite code generator ──────────────────────────────────────────────────

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface ProfileWithCompany extends Profile {
  company: Company | null;
}

export interface CompanyMember {
  id: string;
  company_id: string;
  user_id: string;
  role: string;
  can_see_financials: boolean;
  can_see_all_jobs: boolean;
  can_see_client_info: boolean;
  created_at: string;
  // joined from auth.users via RPC or display_name from profiles
  display_name?: string | null;
  email?: string | null;
}

// ── Ensure owner has profile + company (idempotent) ────────────────────────

export async function ensureOwnerSetup(): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: existing } = await supabase
    .from("profiles")
    .select("id, role, company_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!existing) {
    // Brand new user — create company + profile
    let inviteCode = generateInviteCode();
    let companyId: string | null = null;
    for (let i = 0; i < 5; i++) {
      const { data: company } = await supabase
        .from("companies")
        .insert({ owner_user_id: user.id, invite_code: inviteCode })
        .select("id")
        .single();
      if (company) { companyId = company.id; break; }
      inviteCode = generateInviteCode();
    }
    await supabase.from("profiles").insert({
      id: user.id,
      role: "owner",
      company_id: companyId,
    });
  } else if (existing.role === "owner" && !existing.company_id) {
    // Profile exists without a company
    let inviteCode = generateInviteCode();
    const { data: company } = await supabase
      .from("companies")
      .insert({ owner_user_id: user.id, invite_code: inviteCode })
      .select("id")
      .single();
    if (company) {
      await supabase.from("profiles").update({ company_id: company.id }).eq("id", user.id);
    }
  }
}

// ── Get current user's profile with company ───────────────────────────────

export async function getMyProfile(): Promise<ProfileWithCompany | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*, companies(*)")
    .eq("id", user.id)
    .maybeSingle();

  if (!data) return null;
  const { companies, ...profile } = data as Profile & { companies: Company | null };
  return { ...profile, company: companies ?? null };
}

// ── Owner: get all field members ──────────────────────────────────────────

export async function getTeamMembers(): Promise<CompanyMember[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get owner's company
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.company_id) return [];

  const { data } = await supabase
    .from("company_members")
    .select("*, profiles(display_name)")
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: true });

  return ((data ?? []) as (CompanyMember & { profiles: { display_name: string | null } | null })[])
    .map(({ profiles: p, ...m }) => ({ ...m, display_name: p?.display_name ?? null }));
}

// ── Field member: join team via invite code ───────────────────────────────

export async function joinTeam(inviteCode: string): Promise<{ error?: string; success?: boolean }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: company } = await supabase
    .from("companies")
    .select("id, owner_user_id")
    .eq("invite_code", inviteCode.trim().toUpperCase())
    .maybeSingle();

  if (!company) return { error: "Invalid invite code. Check with your employer." };

  // Check if already a member
  const { data: existing } = await supabase
    .from("company_members")
    .select("id")
    .eq("company_id", company.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) return { error: "You're already a member of this team." };

  // Create company_members record
  const { error: insertError } = await supabase.from("company_members").insert({
    company_id: company.id,
    user_id: user.id,
    role: "field_member",
  });

  if (insertError) return { error: insertError.message };

  // Update profile role + company_id
  await supabase.from("profiles").upsert({
    id: user.id,
    role: "field_member",
    company_id: company.id,
  }, { onConflict: "id" });

  return { success: true };
}

// ── Owner: update field member permissions ────────────────────────────────

export async function updateMemberPermissions(
  memberId: string,
  permissions: Partial<{
    can_see_financials: boolean;
    can_see_all_jobs: boolean;
    can_see_client_info: boolean;
  }>
): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("company_members")
    .update(permissions)
    .eq("id", memberId);

  // Mirror to profiles for middleware checks
  const member = await supabase
    .from("company_members")
    .select("user_id")
    .eq("id", memberId)
    .single();

  if (!error && member.data) {
    await supabase.from("profiles").update(permissions).eq("id", member.data.user_id);
  }

  return error ? { error: error.message } : {};
}

// ── Owner: remove field member ────────────────────────────────────────────

export async function removeMember(memberId: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Get user_id before deleting
  const { data: member } = await supabase
    .from("company_members")
    .select("user_id")
    .eq("id", memberId)
    .single();

  const { error } = await supabase
    .from("company_members")
    .delete()
    .eq("id", memberId);

  // Reset their profile
  if (!error && member) {
    await supabase.from("profiles")
      .update({ role: "owner", company_id: null, can_see_financials: false, can_see_all_jobs: false, can_see_client_info: false })
      .eq("id", member.user_id);
  }

  return error ? { error: error.message } : {};
}

// ── Owner: regenerate invite code ─────────────────────────────────────────

export async function regenerateInviteCode(): Promise<{ code?: string; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const newCode = generateInviteCode();
  const { error } = await supabase
    .from("companies")
    .update({ invite_code: newCode })
    .eq("owner_user_id", user.id);

  return error ? { error: error.message } : { code: newCode };
}
