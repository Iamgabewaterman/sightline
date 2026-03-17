"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createJob(formData: FormData) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const name = formData.get("name") as string;
  const types = formData.getAll("types") as string[];
  const address = formData.get("address") as string;
  const notes = formData.get("notes") as string;

  if (types.length === 0) {
    return { error: "Select at least one job type." };
  }

  const client_id = formData.get("client_id") as string | null;

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({ name, types, address, notes: notes || null, user_id: user.id, client_id: client_id || null })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
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

  const name = formData.get("name") as string;
  const types = formData.getAll("types") as string[];
  const address = formData.get("address") as string;
  const notes = formData.get("notes") as string;
  const lockbox_code = formData.get("lockbox_code") as string;

  if (types.length === 0) {
    return { error: "Select at least one job type." };
  }

  const client_id = formData.get("client_id") as string | null;

  const { error } = await supabase
    .from("jobs")
    .update({ name, types, address, notes: notes || null, lockbox_code: lockbox_code || null, client_id: client_id || null, updated_at: new Date().toISOString() })
    .eq("id", id);

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
  const { error } = await supabase
    .from("jobs")
    .update({ ...dims, updated_at: new Date().toISOString() })
    .eq("id", id);
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

  const { error } = await supabase
    .from("jobs")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/jobs");
  return { success: true };
}
