import { createClient } from "@supabase/supabase-js";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Returns true if this key has NOT been sent before (i.e. safe to send).
 * Inserts the key atomically — concurrent calls are safe via the PRIMARY KEY conflict.
 */
export async function shouldSend(key: string): Promise<boolean> {
  const supabase = adminClient();
  const { error } = await supabase
    .from("notification_dedup")
    .insert({ key })
    .select()
    .single();

  // Duplicate key = already sent
  if (error?.code === "23505") return false;
  return !error;
}

/**
 * Like shouldSend but also respects a TTL — key expires after ttlHours.
 * Deletes expired entry first so the notification can fire again.
 */
export async function shouldSendWithTTL(key: string, ttlHours: number): Promise<boolean> {
  const supabase = adminClient();

  // Remove expired entry if present
  const cutoff = new Date(Date.now() - ttlHours * 3600 * 1000).toISOString();
  await supabase
    .from("notification_dedup")
    .delete()
    .eq("key", key)
    .lt("sent_at", cutoff);

  return shouldSend(key);
}
