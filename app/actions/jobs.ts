"use server";

import { createClient } from "@/lib/supabase/server";
import { JobType } from "@/types";

export async function createJob(formData: FormData) {
  const supabase = createClient();

  const name = formData.get("name") as string;
  const type = formData.get("type") as JobType;
  const address = formData.get("address") as string;
  const notes = formData.get("notes") as string;

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({ name, type, address, notes: notes || null })
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
