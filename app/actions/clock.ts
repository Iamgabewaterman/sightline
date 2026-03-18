"use server";

import { createClient } from "@/lib/supabase/server";
import { ClockSession, Job } from "@/types";
import { sendPushToUser } from "@/lib/push";

export async function getActiveSession(): Promise<ClockSession | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("clock_sessions")
    .select("*, jobs(name)")
    .eq("user_id", user.id)
    .is("clocked_out_at", null)
    .order("clocked_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    ...data,
    job_name: (data.jobs as { name: string } | null)?.name ?? undefined,
  } as ClockSession;
}

export async function getActiveJobs(): Promise<Job[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("jobs")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .returns<Job[]>();

  return data ?? [];
}

export async function getDefaultRate(): Promise<number | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Use the highest-rate contact as a sensible default (owner's own rate)
  const { data } = await supabase
    .from("contacts")
    .select("hourly_rate")
    .eq("user_id", user.id)
    .not("hourly_rate", "is", null)
    .order("hourly_rate", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.hourly_rate ?? null;
}

export async function clockIn(
  jobId: string,
  crewName: string,
  rate: number
): Promise<{ session?: ClockSession; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Close any existing open sessions first
  await supabase
    .from("clock_sessions")
    .update({ clocked_out_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("clocked_out_at", null);

  const { data, error } = await supabase
    .from("clock_sessions")
    .insert({ user_id: user.id, job_id: jobId, rate, clocked_in_at: new Date().toISOString() })
    .select("*, jobs(name)")
    .single();

  if (error) return { error: error.message };

  const session: ClockSession = {
    ...data,
    job_name: (data.jobs as { name: string } | null)?.name ?? undefined,
  } as ClockSession;

  // Notify job owner if clocking in is done by a field member
  const { data: job } = await supabase
    .from("jobs")
    .select("user_id, name")
    .eq("id", jobId)
    .single();
  if (job && job.user_id !== user.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    const name = profile?.display_name ?? crewName;
    sendPushToUser(job.user_id, {
      title: "Crew Clocked In",
      body: `${name} clocked in at ${job.name}`,
      url: `/jobs/${jobId}`,
    });
  }

  return { session };
}

export async function clockOut(
  sessionId: string,
  crewName: string,
  rate: number
): Promise<{ hours?: number; total?: number; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Fetch session to get start time and job_id
  const { data: session } = await supabase
    .from("clock_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single<ClockSession>();

  if (!session) return { error: "Session not found" };

  const now = new Date();
  const start = new Date(session.clocked_in_at);
  const hours = Math.round(((now.getTime() - start.getTime()) / 3600000) * 100) / 100;
  const total = Math.round(hours * rate * 100) / 100;

  // Update session
  await supabase
    .from("clock_sessions")
    .update({ clocked_out_at: now.toISOString(), hours, rate, total })
    .eq("id", sessionId);

  // Create labor log
  const { error: laborError } = await supabase
    .from("labor_logs")
    .insert({ job_id: session.job_id, crew_name: crewName, hours, rate });

  if (laborError) return { error: laborError.message };

  // Notify job owner if clock-out is done by a field member
  const { data: job } = await supabase
    .from("jobs")
    .select("user_id, name")
    .eq("id", session.job_id)
    .single();
  if (job && job.user_id !== user.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    const name = profile?.display_name ?? crewName;
    const hoursDisplay = hours % 1 === 0 ? `${hours}` : hours.toFixed(1);
    sendPushToUser(job.user_id, {
      title: "Crew Clocked Out",
      body: `${name} clocked out of ${job.name} after ${hoursDisplay} hrs`,
      url: `/jobs/${session.job_id}`,
    });
  }

  return { hours, total };
}
