"use server";

import { createClient } from "@/lib/supabase/server";

export const NOTIF_TYPES = {
  money: [
    { key: "invoice_paid",    label: "Invoice paid" },
    { key: "invoice_viewed",  label: "Invoice viewed" },
    { key: "invoice_overdue", label: "Invoice overdue" },
    { key: "payment_failed",  label: "Payment failed" },
  ],
  jobsite: [
    { key: "clocked_in",          label: "Clocked in" },
    { key: "clocked_out",         label: "Clocked out" },
    { key: "not_clocked_in",      label: "Not clocked in" },
    { key: "job_assigned",        label: "Job assigned" },
    { key: "assignment_reminder", label: "Assignment reminder" },
    { key: "no_crew_assigned",    label: "No crew assigned" },
    { key: "punch_list_complete", label: "Punch list complete" },
    { key: "photo_uploaded",      label: "Photo uploaded" },
    { key: "job_on_hold",         label: "Job put on hold" },
  ],
  operational: [
    { key: "no_activity_3_days",    label: "No activity 3 days" },
    { key: "materials_over_budget", label: "Materials over budget" },
    { key: "labor_near_budget",     label: "Labor near budget" },
    { key: "job_falling_behind",    label: "Job falling behind" },
  ],
  client: [
    { key: "portal_viewed", label: "Portal viewed" },
    { key: "quote_signed",  label: "Quote signed" },
  ],
} as const;

export type NotifKey =
  | "invoice_paid" | "invoice_viewed" | "invoice_overdue" | "payment_failed"
  | "clocked_in" | "clocked_out" | "not_clocked_in" | "job_assigned"
  | "assignment_reminder" | "no_crew_assigned" | "punch_list_complete"
  | "photo_uploaded" | "job_on_hold"
  | "no_activity_3_days" | "materials_over_budget" | "labor_near_budget" | "job_falling_behind"
  | "portal_viewed" | "quote_signed";

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
