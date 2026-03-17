"use server";

import { createClient } from "@/lib/supabase/server";

export interface Assignment {
  id: string;
  company_id: string;
  job_id: string;
  user_id: string;
  assigned_date: string; // YYYY-MM-DD
  notes: string | null;
  created_at: string;
  // joined
  job_name?: string;
  job_address?: string;
  job_lockbox?: string | null;
  member_name?: string | null;
}

// ── Get assignments for a week (owner: all; field member: own) ─────────────

export async function getWeekAssignments(weekStart: string): Promise<Assignment[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return [];

  // Calculate week end (7 days)
  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const weekEnd = end.toISOString().slice(0, 10);

  if (profile.role === "field_member") {
    const { data } = await supabase
      .from("job_assignments")
      .select("*, jobs(name, address, lockbox_code)")
      .eq("user_id", user.id)
      .gte("assigned_date", weekStart)
      .lte("assigned_date", weekEnd)
      .order("assigned_date");

    return ((data ?? []) as (Assignment & { jobs: { name: string; address: string; lockbox_code: string | null } | null })[])
      .map(({ jobs: j, ...a }) => ({
        ...a,
        job_name: j?.name ?? "",
        job_address: j?.address ?? "",
        job_lockbox: j?.lockbox_code ?? null,
      }));
  }

  // Owner: all assignments for company
  const { data } = await supabase
    .from("job_assignments")
    .select("*, jobs(name, address), profiles(display_name)")
    .eq("company_id", profile.company_id)
    .gte("assigned_date", weekStart)
    .lte("assigned_date", weekEnd)
    .order("assigned_date");

  return ((data ?? []) as (Assignment & {
    jobs: { name: string; address: string } | null;
    profiles: { display_name: string | null } | null;
  })[]).map(({ jobs: j, profiles: p, ...a }) => ({
    ...a,
    job_name: j?.name ?? "",
    job_address: j?.address ?? "",
    member_name: p?.display_name ?? null,
  }));
}

// ── Get today's assignments for field member home screen ──────────────────

export async function getTodayAssignments(): Promise<Assignment[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const today = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("job_assignments")
    .select("*, jobs(name, address, lockbox_code)")
    .eq("user_id", user.id)
    .eq("assigned_date", today)
    .order("created_at");

  return ((data ?? []) as (Assignment & { jobs: { name: string; address: string; lockbox_code: string | null } | null })[])
    .map(({ jobs: j, ...a }) => ({
      ...a,
      job_name: j?.name ?? "",
      job_address: j?.address ?? "",
      job_lockbox: j?.lockbox_code ?? null,
    }));
}

// ── Create assignments (owner) ────────────────────────────────────────────

export async function createAssignments(params: {
  jobId: string;
  userIds: string[];
  dates: string[]; // array of YYYY-MM-DD
  notes: string;
}): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.company_id) return { error: "No company found" };

  const rows = params.dates.flatMap((date) =>
    params.userIds.map((uid) => ({
      company_id: profile.company_id,
      job_id: params.jobId,
      user_id: uid,
      assigned_date: date,
      notes: params.notes || null,
    }))
  );

  // Upsert to avoid duplicates on same job+user+date
  const { error } = await supabase
    .from("job_assignments")
    .upsert(rows, { onConflict: "job_id,user_id,assigned_date", ignoreDuplicates: true });

  return error ? { error: error.message } : {};
}

// ── Update assignment notes (owner) ──────────────────────────────────────

export async function updateAssignmentNotes(id: string, notes: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("job_assignments")
    .update({ notes: notes || null })
    .eq("id", id);

  return error ? { error: error.message } : {};
}

// ── Delete assignment (owner) ─────────────────────────────────────────────

export async function deleteAssignment(id: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("job_assignments")
    .delete()
    .eq("id", id);

  return error ? { error: error.message } : {};
}

// ── Get active jobs for owner (for assignment picker) ─────────────────────

export async function getActiveJobsForAssignment(): Promise<{ id: string; name: string; address: string }[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("jobs")
    .select("id, name, address")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("name");

  return data ?? [];
}

// ── Get field members for owner ───────────────────────────────────────────

export async function getFieldMembersForAssignment(): Promise<{ user_id: string; display_name: string | null }[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.company_id) return [];

  const { data } = await supabase
    .from("company_members")
    .select("user_id, profiles(display_name)")
    .eq("company_id", profile.company_id);

  return ((data ?? []) as unknown as { user_id: string; profiles: { display_name: string | null } | null }[])
    .map((m) => ({ user_id: m.user_id, display_name: m.profiles?.display_name ?? null }));
}
