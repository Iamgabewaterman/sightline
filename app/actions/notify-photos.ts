"use server";

import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";
import { shouldSendWithTTL } from "@/lib/notif-dedup";

/**
 * Called after a field member uploads photos — batches within a 5-minute window.
 * Skips if the uploader is the job owner.
 */
export async function notifyOwnerPhotosUploaded(jobId: string, count: number): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: job } = await supabase
    .from("jobs")
    .select("user_id, name")
    .eq("id", jobId)
    .single();

  // Skip if uploader is the owner
  if (!job || job.user_id === user.id) return;

  // 5-minute batch window
  const window = Math.floor(Date.now() / (5 * 60 * 1000));
  const dedupKey = `photos_batch:${jobId}:${window}`;

  const ok = await shouldSendWithTTL(dedupKey, 0.1); // 6 minutes TTL
  if (!ok) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const name = profile?.display_name ?? "A crew member";
  const photoWord = count === 1 ? "photo" : "photos";

  await sendPushToUser(job.user_id, {
    title: "Photos Added",
    body: `${name} added ${count} ${photoWord} to ${job.name}`,
    url: `/jobs/${jobId}`,
  });
}
