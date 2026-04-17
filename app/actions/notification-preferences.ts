"use server";

import { createClient } from "@/lib/supabase/server";
import { NOTIF_TYPES, NotifKey } from "@/app/lib/notification-preferences-config";

const ALL_KEYS: NotifKey[] = [
  ...NOTIF_TYPES.money.map(t => t.key as NotifKey),
  ...NOTIF_TYPES.jobsite.map(t => t.key as NotifKey),
  ...NOTIF_TYPES.operational.map(t => t.key as NotifKey),
  ...NOTIF_TYPES.client.map(t => t.key as NotifKey),
];

function defaultPrefs(): Record<NotifKey, boolean> {
  return Object.fromEntries(ALL_KEYS.map(k => [k, true])) as Record<NotifKey, boolean>;
}

export async function getNotificationPreferences(): Promise<Record<NotifKey, boolean>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return defaultPrefs();

  const { data } = await supabase
    .from("profiles")
    .select("notification_preferences")
    .eq("id", user.id)
    .maybeSingle();

  if (!data?.notification_preferences) return defaultPrefs();
  // Merge stored prefs with defaults so new keys default to ON
  return { ...defaultPrefs(), ...(data.notification_preferences as Record<NotifKey, boolean>) };
}

export async function saveNotificationPreferences(
  prefs: Record<NotifKey, boolean>
): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ notification_preferences: prefs })
    .eq("id", user.id);

  if (error) return { error: error.message };
  return {};
}
