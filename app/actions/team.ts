"use server";

import { createClient } from "@/lib/supabase/server";
import { Profile, Company, FieldMember } from "@/types";

// ── Invite code generator ──────────────────────────────────────────────────

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ── Get current user's profile (with company) ─────────────────────────────

export interface ProfileWithCompany extends Profile {
  company: Company | null;
}

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

// ── Ensure profile + company exist (called on first dashboard load) ────────

export async function ensureOwnerSetup(): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Check if profile exists
  const { data: existing } = await supabase
    .from("profiles")
    .select("id, role, company_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!existing) {
    // Create company first
    let inviteCode = generateInviteCode();
    let inserted = false;
    // Retry on rare collision
    for (let i = 0; i < 5; i++) {
      const { data: company, error } = await supabase
        .from("companies")
        .insert({ owner_user_id: user.id, invite_code: inviteCode })
        .select("id")
        .single();
      if (!error && company) {
        await supabase.from("profiles").insert({
          id: user.id,
          role: "owner",
          company_id: company.id,
        });
        inserted = true;
        break;
      }
      inviteCode = generateInviteCode();
    }
    if (!inserted) {
      // Fallback: create profile without company
      await supabase.from("profiles").insert({ id: user.id, role: "owner" });
    }
  } else if (existing.role === "owner" && !existing.company_id) {
    // Profile exists but no company (edge case)
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

// ── Field member: join team via invite code ───────────────────────────────

export async function joinTeam(inviteCode: string): Promise<{ error?: string; success?: boolean }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Find company by invite code
  const { data: company } = await supabase
    .from("companies")
    .select("id, owner_user_id")
    .eq("invite_code", inviteCode.trim().toUpperCase())
    .maybeSingle();

  if (!company) return { error: "Invalid invite code. Check the code and try again." };

  // Check if already on a team
  const { data: existing } = await supabase
    .from("profiles")
    .select("id, role, company_id")
    .eq("id", user.id)
    .maybeSingle();

  if (existing?.company_id === company.id) {
    return { error: "You're already a member of this team." };
  }
  if (existing?.company_id && existing.company_id !== company.id) {
    return { error: "You're already on a different team." };
  }

  if (!existing) {
    await supabase.from("profiles").insert({
      id: user.id,
      role: "field_member",
      company_id: company.id,
    });
  } else {
    await supabase.from("profiles").update({
      role: "field_member",
      company_id: company.id,
    }).eq("id", user.id);
  }

  return { success: true };
}

// ── Owner: get team members ───────────────────────────────────────────────

export async function getTeamMembers(): Promise<FieldMember[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get owner's company
  const { data: myProfile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!myProfile?.company_id) return [];

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("company_id", myProfile.company_id)
    .eq("role", "field_member");

  return (data ?? []) as FieldMember[];
}

// ── Owner: update field member permissions ────────────────────────────────

export async function updateMemberPermissions(
  memberId: string,
  permissions: {
    can_see_financials?: boolean;
    can_see_all_jobs?: boolean;
    can_see_client_info?: boolean;
  }
): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update(permissions)
    .eq("id", memberId)
    .eq("role", "field_member");

  return error ? { error: error.message } : {};
}

// ── Owner: remove field member ────────────────────────────────────────────

export async function removeMember(memberId: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ role: "owner", company_id: null })
    .eq("id", memberId)
    .eq("role", "field_member");

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
