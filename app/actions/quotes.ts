"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { QuoteAddon, SavedLineItem } from "@/types";
import { sendPushToUser } from "@/lib/push";
import { sendQuoteEmail } from "@/lib/email";

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function saveJobQuote(data: {
  jobId: string;
  materialTotal: number;
  laborTotal: number;
  profitMarginPct: number;
  finalQuote: number;
  addons: QuoteAddon[];
  displayShowAddress?: boolean;
  displayShowValidUntil?: boolean;
  displayNotes?: string | null;
  clientLineItems?: Array<{ name: string; amount: number }>;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Replace any existing quote for this job
  await supabase
    .from("estimates")
    .delete()
    .eq("job_id", data.jobId)
    .eq("type", "job_quote");

  const { data: inserted, error } = await supabase
    .from("estimates")
    .insert({
      job_id: data.jobId,
      user_id: user.id,
      type: "job_quote",
      material_total: data.materialTotal,
      labor_total: data.laborTotal,
      profit_margin_pct: data.profitMarginPct,
      final_quote: data.finalQuote,
      addons: data.addons,
      quote_display_show_address: data.displayShowAddress ?? true,
      quote_display_show_valid_until: data.displayShowValidUntil ?? true,
      quote_display_notes: data.displayNotes ?? null,
      quote_client_line_items: data.clientLineItems ?? [],
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { success: true, estimateId: inserted.id as string };
}

export async function saveLineItem(
  name: string,
  amount: number
): Promise<{ item?: SavedLineItem; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("saved_line_items")
    .insert({ user_id: user.id, name, amount })
    .select()
    .single<SavedLineItem>();

  if (error) return { error: error.message };
  return { item: data };
}

export async function sendForSignature(
  estimateId: string
): Promise<{ url?: string; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify ownership
  const { data: est } = await supabase
    .from("estimates")
    .select("id, job_id, quote_status, final_quote, addons")
    .eq("id", estimateId)
    .eq("user_id", user.id)
    .single();

  if (!est) return { error: "Quote not found" };
  if (est.quote_status === "accepted") return { error: "Quote already signed" };

  const token = crypto.randomUUID();

  const { error } = await supabase
    .from("estimates")
    .update({ signature_token: token, quote_status: "sent" })
    .eq("id", estimateId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://sightline.one";
  const signUrl = `${appUrl}/sign/${estimateId}/${token}`;

  // Fire quote email to client — non-blocking
  void (async () => {
    try {
      const [{ data: job }, { data: bp }] = await Promise.all([
        supabase.from("jobs").select("name, client_id").eq("id", est.job_id).single(),
        supabase.from("business_profiles").select("business_name, email").eq("user_id", user.id).maybeSingle(),
      ]);
      if (!job || !bp?.business_name) return;

      let clientEmail: string | null = null;
      let clientName: string | null = null;
      if (job.client_id) {
        const { data: cl } = await supabase
          .from("clients").select("name, email").eq("id", job.client_id).single();
        clientEmail = cl?.email ?? null;
        clientName = cl?.name ?? null;
      }
      if (!clientEmail) return;

      const addonsTotal = ((est.addons as QuoteAddon[]) ?? [])
        .reduce((s, a) => s + Number(a.amount), 0);

      await sendQuoteEmail({
        to: clientEmail,
        clientName,
        businessName: bp.business_name,
        contractorEmail: bp.email ?? null,
        jobName: job.name,
        quoteTotal: Number(est.final_quote) + addonsTotal,
        signUrl,
      });
    } catch {
      // Email errors never block the action
    }
  })();

  return { url: signUrl };
}

export async function submitSignature(params: {
  estimateId: string;
  token: string;
  signedByName: string;
  signatureData: string;
}): Promise<{ success?: boolean; error?: string }> {
  const headersList = headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0].trim() ??
    headersList.get("x-real-ip") ??
    "unknown";

  const supabase = adminClient();

  // Validate token
  const { data: est } = await supabase
    .from("estimates")
    .select("id, user_id, job_id, quote_status, signature_token")
    .eq("id", params.estimateId)
    .eq("signature_token", params.token)
    .single();

  if (!est) return { error: "Invalid or expired signature link." };
  if (est.quote_status === "accepted") return { error: "Quote has already been signed." };

  const { error } = await supabase
    .from("estimates")
    .update({
      quote_status: "accepted",
      signed_at: new Date().toISOString(),
      signed_by_name: params.signedByName.trim(),
      signed_by_ip: ip,
      signature_data: params.signatureData,
    })
    .eq("id", params.estimateId);

  if (error) return { error: error.message };

  // Fetch job name and total for push notification
  try {
    const [{ data: job }, { data: estimate }] = await Promise.all([
      supabase.from("jobs").select("name").eq("id", est.job_id).single(),
      supabase.from("estimates").select("final_quote, addons").eq("id", params.estimateId).single(),
    ]);

    const addonsTotal = ((estimate?.addons as QuoteAddon[]) ?? []).reduce(
      (s, a) => s + Number(a.amount),
      0
    );
    const total = Math.round((estimate?.final_quote ?? 0) + addonsTotal);

    await sendPushToUser(est.user_id, {
      title: "Quote Signed",
      body: `${params.signedByName} signed the quote for ${job?.name ?? "a job"} — $${total.toLocaleString()}`,
      url: `/jobs/${est.job_id}`,
    });
  } catch {
    // Push errors never block the action
  }

  return { success: true };
}
