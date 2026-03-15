"use server";

import { createClient } from "@/lib/supabase/server";

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

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({ name, types, address, notes: notes || null, user_id: user.id })
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

  const { error } = await supabase
    .from("jobs")
    .update({ name, types, address, notes: notes || null, lockbox_code: lockbox_code || null, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function updateJobDimensions(
  id: string,
  dims: { dim_length: number | null; dim_width: number | null; dim_height: number | null }
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
  const { error } = await supabase
    .from("jobs")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  return { success: true };
}
