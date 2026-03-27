import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

webpush.setVapidDetails(
  "mailto:admin@sightline.one",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * Send a push notification to all subscriptions for a given user.
 * Pass notifType (e.g. "invoice_paid") to respect per-user notification preferences.
 * Silently skips if no subscriptions found or preference disabled. Never throws.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  notifType?: string
): Promise<void> {
  try {
    const supabase = adminClient();

    // Check per-user notification preferences
    if (notifType) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("notification_preferences")
        .eq("id", userId)
        .maybeSingle();
      if (profile?.notification_preferences) {
        const prefs = profile.notification_preferences as Record<string, boolean>;
        if (prefs[notifType] === false) return;
      }
    }
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId);

    if (!subs?.length) return;

    const notification = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url ?? "/jobs",
      icon: "/icon-192.png",
    });

    await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          notification
        ).catch(async (err: { statusCode?: number }) => {
          // 410 Gone = subscription expired — remove it
          if (err?.statusCode === 410) {
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("endpoint", sub.endpoint);
          }
        })
      )
    );
  } catch {
    // Never let push errors bubble up and break the triggering action
  }
}
