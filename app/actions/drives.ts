"use server";

import { createClient } from "@/lib/supabase/server";
import { Drive } from "@/types";

function mapRow(r: Drive & { jobs?: { name: string } | null }): Drive {
  const { jobs, ...rest } = r;
  return { ...rest, job_name: jobs?.name ?? undefined };
}

export async function getActiveDrive(): Promise<Drive | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("drives")
    .select("*, jobs(name)")
    .eq("user_id", user.id)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? mapRow(data as Drive & { jobs: { name: string } | null }) : null;
}

export async function getDrives(): Promise<Drive[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("drives")
    .select("*, jobs(name)")
    .eq("user_id", user.id)
    .not("ended_at", "is", null)
    .order("started_at", { ascending: false });

  return (data ?? []).map((r) => mapRow(r as Drive & { jobs: { name: string } | null }));
}

export async function startDrive(
  startLat: number,
  startLng: number,
  startAccuracy: number | null
): Promise<{ drive?: Drive; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Check no active drive already exists
  const existing = await getActiveDrive();
  if (existing) return { error: "A drive is already in progress" };

  const { data, error } = await supabase
    .from("drives")
    .insert({
      user_id: user.id,
      start_lat: startLat,
      start_lng: startLng,
      start_accuracy: startAccuracy,
      started_at: new Date().toISOString(),
      category: "work",
    })
    .select("*, jobs(name)")
    .single();

  if (error) return { error: error.message };
  return { drive: mapRow(data as Drive & { jobs: { name: string } | null }) };
}

export async function stopDrive(
  driveId: string,
  endLat: number,
  endLng: number,
  endAccuracy: number | null,
  miles: number,
  isEstimated: boolean,
  category: string,
  jobId: string | null,
  notes: string | null
): Promise<{ drive?: Drive; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Get start time to compute duration
  const { data: existing } = await supabase
    .from("drives")
    .select("started_at")
    .eq("id", driveId)
    .eq("user_id", user.id)
    .single();

  const endedAt = new Date().toISOString();
  const durationMinutes = existing
    ? Math.round((new Date(endedAt).getTime() - new Date(existing.started_at).getTime()) / 60000)
    : null;

  const { data, error } = await supabase
    .from("drives")
    .update({
      end_lat: endLat,
      end_lng: endLng,
      end_accuracy: endAccuracy,
      miles,
      is_estimated: isEstimated,
      duration_minutes: durationMinutes,
      ended_at: endedAt,
      category,
      job_id: jobId || null,
      notes: notes || null,
    })
    .eq("id", driveId)
    .eq("user_id", user.id)
    .select("*, jobs(name)")
    .single();

  if (error) return { error: error.message };
  return { drive: mapRow(data as Drive & { jobs: { name: string } | null }) };
}

export async function updateDrive(
  driveId: string,
  updates: {
    category?: string;
    job_id?: string | null;
    notes?: string | null;
    miles?: number;
  }
): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("drives")
    .update(updates)
    .eq("id", driveId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return {};
}

export async function deleteDrive(driveId: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("drives")
    .delete()
    .eq("id", driveId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return {};
}

export async function abandonActiveDrive(driveId: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("drives")
    .delete()
    .eq("id", driveId)
    .eq("user_id", user.id)
    .is("ended_at", null);

  if (error) return { error: error.message };
  return {};
}
