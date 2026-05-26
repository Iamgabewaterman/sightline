"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { sendPushToUser } from "@/lib/push";
import { PortalMessage } from "@/types";

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function getPortalMessages(
  jobId: string,
  portalToken: string
): Promise<PortalMessage[]> {
  const admin = adminClient();
  const { data: job } = await admin
    .from("jobs")
    .select("id")
    .eq("id", jobId)
    .eq("portal_token", portalToken)
    .eq("portal_enabled", true)
    .single();
  if (!job) return [];

  const { data } = await admin
    .from("portal_messages")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true })
    .returns<PortalMessage[]>();
  return data ?? [];
}

export async function sendPortalMessage(
  jobId: string,
  portalToken: string,
  senderName: string,
  messageText: string,
  attachmentUrl?: string
): Promise<{ error?: string }> {
  const admin = adminClient();

  const { data: job } = await admin
    .from("jobs")
    .select("id, user_id, name")
    .eq("id", jobId)
    .eq("portal_token", portalToken)
    .eq("portal_enabled", true)
    .single();
  if (!job) return { error: "Invalid portal" };

  const { error } = await admin.from("portal_messages").insert({
    job_id: jobId,
    portal_token: portalToken,
    sender_type: "client",
    sender_name: senderName,
    message_text: messageText || null,
    has_attachment: !!attachmentUrl,
    attachment_url: attachmentUrl ?? null,
  });
  if (error) return { error: error.message };

  const preview = (messageText ?? "").slice(0, 50);
  sendPushToUser(job.user_id, {
    title: "New Message",
    body: `${senderName} on ${job.name}: ${preview}`,
    url: `/jobs/${jobId}`,
  });

  return {};
}

export async function sendContractorMessage(
  jobId: string,
  messageText: string,
  attachmentUrl?: string
): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: job } = await supabase
    .from("jobs")
    .select("id, portal_token")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .single();
  if (!job?.portal_token) return { error: "Portal not found" };

  const [{ data: bp }, { data: profile }] = await Promise.all([
    supabase.from("business_profiles").select("business_name, owner_name").eq("user_id", user.id).maybeSingle(),
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
  ]);
  const senderName = bp?.business_name ?? bp?.owner_name ?? profile?.display_name ?? "Contractor";

  const { error } = await supabase.from("portal_messages").insert({
    job_id: jobId,
    portal_token: job.portal_token,
    sender_type: "contractor",
    sender_name: senderName,
    message_text: messageText || null,
    has_attachment: !!attachmentUrl,
    attachment_url: attachmentUrl ?? null,
  });
  if (error) return { error: error.message };
  return {};
}

export async function getContractorMessages(jobId: string): Promise<PortalMessage[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("portal_messages")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true })
    .returns<PortalMessage[]>();
  return data ?? [];
}

export async function markPortalMessagesRead(jobId: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("portal_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("job_id", jobId)
    .eq("sender_type", "client")
    .is("read_at", null);
}

export async function getUnreadPortalMessageCounts(
  jobIds: string[]
): Promise<Record<string, number>> {
  if (jobIds.length === 0) return {};
  const supabase = createClient();
  const { data } = await supabase
    .from("portal_messages")
    .select("job_id")
    .in("job_id", jobIds)
    .eq("sender_type", "client")
    .is("read_at", null);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.job_id] = (counts[row.job_id] ?? 0) + 1;
  }
  return counts;
}
