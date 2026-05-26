"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";

const ADMIN_EMAIL = "gabew595@gmail.com";

async function assertAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) throw new Error("Unauthorized");
  return user;
}

export async function grantLifetimeAccess(
  email: string
): Promise<{ ok?: true; error?: string }> {
  try {
    await assertAdmin();
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (error) return { error: error.message };
    const target = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase().trim()
    );
    if (!target) return { error: `No user found with email "${email}".` };
    const { error: upsertError } = await admin
      .from("profiles")
      .update({ is_lifetime: true })
      .eq("id", target.id);
    if (upsertError) return { error: upsertError.message };
    return { ok: true };
  } catch {
    return { error: "Unauthorized" };
  }
}

export async function markAsContacted(
  targetUserId: string
): Promise<{ ok?: true; error?: string }> {
  try {
    await assertAdmin();
    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({ contacted_at: new Date().toISOString() })
      .eq("id", targetUserId);
    if (error) return { error: error.message };
    return { ok: true };
  } catch {
    return { error: "Unauthorized" };
  }
}

export async function sendTestPush(
  userId: string
): Promise<{ ok?: true; error?: string }> {
  try {
    await assertAdmin();
    await sendPushToUser(userId, {
      title: "Sightline HQ — Test",
      body: "Push notifications are working correctly.",
      url: "/hq",
    });
    return { ok: true };
  } catch {
    return { error: "Failed to send push notification." };
  }
}
