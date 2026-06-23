"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sendPushToUser } from "@/lib/push";
import { geocodeAddress } from "@/lib/geocode";

export async function createJob(formData: FormData) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const name = formData.get("name") as string;
  const types = formData.getAll("types") as string[];
  const address = formData.get("address") as string;
  const notes = formData.get("notes") as string;
  const job_number = formData.get("job_number") as string;
  const lockbox_code = formData.get("lockbox_code") as string;
  const estimated_completion_date_raw = formData.get("estimated_completion_date") as string;

  if (!name?.trim()) {
    return { error: "Job name is required." };
  }

  const estimated_completion_date = estimated_completion_date_raw?.trim() || null;
  const client_id = formData.get("client_id") as string | null;

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      name,
      types,
      address,
      notes: notes || null,
      user_id: user.id,
      client_id: client_id || null,
      job_number: job_number || null,
      lockbox_code: lockbox_code || null,
      estimated_completion_date,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  // Geocode address silently
  if (address?.trim()) {
    const coords = await geocodeAddress(address);
    if (coords) {
      await supabase.from("jobs").update({ job_lat: coords.lat, job_lng: coords.lng }).eq("id", job.id);
    }
  }

  // Upload photos if provided
  const photos = formData.getAll("photos") as File[];
  const validPhotos = photos.filter((f) => f.size > 0);

  for (const photo of validPhotos) {
    const ext = photo.name.split(".").pop();
    const path = `${job.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("job-photos")
      .upload(path, photo);

    if (!uploadError) {
      await supabase.from("photos").insert({
        job_id: job.id,
        category: "before",
        storage_path: path,
      });
    }
  }

  return { jobId: job.id };
}

export async function updateJob(id: string, formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const name = formData.get("name") as string;
  const types = formData.getAll("types") as string[];
  const address = formData.get("address") as string;
  const notes = formData.get("notes") as string;
  const lockbox_code = formData.get("lockbox_code") as string;
  const estimated_completion_date_raw = formData.get("estimated_completion_date") as string;
  const job_number = formData.get("job_number") as string;

  if (types.length === 0) {
    return { error: "Select at least one job type." };
  }

  const client_id = formData.get("client_id") as string | null;

  // Geocode address silently
  let coordUpdates: { job_lat?: number; job_lng?: number } = {};
  if (address?.trim()) {
    const coords = await geocodeAddress(address);
    if (coords) coordUpdates = { job_lat: coords.lat, job_lng: coords.lng };
  }

  const estimated_completion_date = estimated_completion_date_raw?.trim() || null;

  const { error } = await supabase
    .from("jobs")
    .update({ name, types, address, notes: notes || null, lockbox_code: lockbox_code || null, estimated_completion_date, client_id: client_id || null, job_number: job_number || null, updated_at: new Date().toISOString(), ...coordUpdates })
    .eq("id", id)
    .eq("user_id", user.id); // defence-in-depth alongside RLS

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function updateJobDimensions(
  id: string,
  dims: {
    dim_length: number | null;
    dim_width: number | null;
    dim_height: number | null;
    calculated_sqft: number | null;
  }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("jobs")
    .update({ ...dims, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  return { success: true };
}

export async function deleteJob(id: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("jobs")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id); // defence-in-depth

  if (error) return { error: error.message };
  return { success: true };
}

export async function updateJobStatus(id: string, status: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: job } = await supabase
    .from("jobs")
    .select("start_date, status, paused_at, total_paused_days")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const updates: Record<string, unknown> = { status, updated_at: now.toISOString() };

  const accumulatedPausedDays = Number(job?.total_paused_days ?? 0);

  // First time going Active → record start_date
  if (status === "active" && !job?.start_date) {
    updates.start_date = today;
  }

  // Resuming from On Hold → close out current pause period
  if (status === "active" && job?.paused_at) {
    const pauseMs = now.getTime() - new Date(job.paused_at).getTime();
    const pauseDays = pauseMs / 86400000;
    updates.total_paused_days = accumulatedPausedDays + pauseDays;
    updates.paused_at = null;
  }

  // Going On Hold → record when the pause started
  if (status === "on_hold") {
    updates.paused_at = now.toISOString();
  }

  // Completing → close any open pause, then calculate net working days
  if (status === "completed") {
    updates.completed_date = today;
    let finalPausedDays = accumulatedPausedDays;
    if (job?.paused_at) {
      const pauseMs = now.getTime() - new Date(job.paused_at).getTime();
      finalPausedDays += pauseMs / 86400000;
      updates.paused_at = null;
      updates.total_paused_days = finalPausedDays;
    }
    if (job?.start_date) {
      const calendarDays = (now.getTime() - new Date(job.start_date).getTime()) / 86400000;
      updates.total_days = Math.max(1, Math.round(calendarDays - finalPausedDays));
    }
  }

  const { data: currentJob } = await supabase
    .from("jobs")
    .select("user_id, name, status")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("jobs")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  // ── Trial qualifying check on job completion ───────────────────────────────
  let trialJobsCompleted: number | undefined;
  if (status === "completed") {
    trialJobsCompleted = await runTrialQualifyingCheck(supabase, id, user.id, job?.start_date ?? null);
  }

  // Notify owner if a field member put the job on hold
  if (status === "on_hold" && currentJob && currentJob.user_id !== user.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    const name = profile?.display_name ?? "A crew member";
    sendPushToUser(currentJob.user_id, {
      title: "Job On Hold",
      body: `${currentJob.name} was put on hold by ${name}`,
      url: `/jobs/${id}`,
    });
  }

  revalidatePath("/jobs");
  return { success: true, trialJobsCompleted };
}

// ── Trial qualifying check ─────────────────────────────────────────────────────
// Returns the new trials_completed_jobs count after this completion (or the
// existing count if the job didn't qualify).
async function runTrialQualifyingCheck(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  jobId: string,
  userId: string,
  startDate: string | null
): Promise<number> {
  const logEvent = async (qualified: boolean, reason: string, count: number) => {
    await supabase.from("trial_events").insert({
      user_id: userId,
      job_id: jobId,
      qualified,
      disqualification_reason: qualified ? null : reason,
      trials_completed_count: count,
    });
  };

  // Must have a start_date (went Active at some point)
  if (!startDate) {
    const { data: p } = await supabase.from("profiles").select("trials_completed_jobs").eq("id", userId).maybeSingle();
    const cur = p?.trials_completed_jobs ?? 0;
    await logEvent(false, "no_start_date", cur);
    return cur;
  }

  // Must have been active ≥ 3 calendar days
  const activeDays = Math.floor((Date.now() - new Date(startDate).getTime()) / 86400000);

  const [
    { count: matCount },
    { count: laborCount },
    { data: profile },
    { data: sub },
  ] = await Promise.all([
    supabase.from("materials").select("id", { count: "exact", head: true }).eq("job_id", jobId),
    supabase.from("labor_logs").select("id", { count: "exact", head: true }).eq("job_id", jobId),
    supabase.from("profiles").select("trials_completed_jobs, is_lifetime").eq("id", userId).maybeSingle(),
    supabase.from("subscriptions").select("status").eq("user_id", userId).maybeSingle(),
  ]);

  const isLifetime = profile?.is_lifetime ?? false;
  const isPaying   = sub?.status === "active" || sub?.status === "trialing";
  const cur        = profile?.trials_completed_jobs ?? 0;

  if (isLifetime || isPaying) {
    await logEvent(false, isLifetime ? "lifetime_user" : "paying_user", cur);
    return cur;
  }

  if (activeDays < 3) {
    await logEvent(false, "active_less_than_3_days", cur);
    return cur;
  }

  if ((matCount ?? 0) === 0 && (laborCount ?? 0) === 0) {
    await logEvent(false, "no_materials_or_labor", cur);
    return cur;
  }

  // Qualifies — increment
  const newCount = cur + 1;
  await Promise.all([
    supabase.from("profiles").update({ trials_completed_jobs: newCount }).eq("id", userId),
    logEvent(true, "", newCount),
  ]);
  return newCount;
}
