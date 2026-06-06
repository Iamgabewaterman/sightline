"use server";

import Stripe from "stripe";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function createPortalCheckoutSession(params: {
  invoiceId: string;
  jobId: string;
  accessToken: string;
  paymentMethod: "card" | "ach";
  milestoneId?: string;
}): Promise<{ url?: string; error?: string }> {
  const { invoiceId, jobId, accessToken, paymentMethod, milestoneId } = params;

  try {
    const supabase = adminClient();
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://sightline.one";
    const portalPath = `/portal/${jobId}/${accessToken}`;
    const successUrl = `${origin}${portalPath}?paid=true`;
    const cancelUrl = `${origin}${portalPath}`;

    // Verify portal access token before creating any session
    const { data: job } = await supabase
      .from("jobs")
      .select("id, name, user_id, portal_enabled, portal_token")
      .eq("id", jobId)
      .single();

    if (!job || !job.portal_enabled || job.portal_token !== accessToken) {
      return { error: "Invalid portal access" };
    }

    // Resolve amount and metadata depending on whether this is a milestone
    let amountCents: number;
    let lineItemName: string;
    let piMeta: Record<string, string>;

    if (milestoneId) {
      const { data: ms } = await supabase
        .from("payment_milestones")
        .select("id, label, amount, status, invoice_id")
        .eq("id", milestoneId)
        .single();
      if (!ms) return { error: "Milestone not found" };
      if (ms.status === "paid") return { error: "Already paid" };
      amountCents = Math.round(Number(ms.amount) * 100);
      lineItemName = `${ms.label} — ${job.name}`;
      piMeta = { milestone_id: milestoneId, invoice_id: ms.invoice_id, job_id: jobId };
    } else {
      const { data: inv } = await supabase
        .from("invoices")
        .select("id, total_amount, status")
        .eq("id", invoiceId)
        .single();
      if (!inv) return { error: "Invoice not found" };
      if (inv.status === "paid") return { error: "Invoice already paid" };
      amountCents = Math.round(Number(inv.total_amount) * 100);
      lineItemName = `Invoice — ${job.name}`;
      piMeta = { invoice_id: invoiceId, job_id: jobId };
    }

    // Look up contractor's connected Stripe account
    const { data: bp } = await supabase
      .from("business_profiles")
      .select("stripe_account_id, stripe_onboarded")
      .eq("user_id", job.user_id)
      .maybeSingle();

    const connectedAccountId =
      bp?.stripe_onboarded && bp?.stripe_account_id ? bp.stripe_account_id : null;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: lineItemName },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      metadata: piMeta,
      payment_intent_data: { metadata: piMeta },
      success_url: successUrl,
      cancel_url: cancelUrl,
      // ACH requires explicit payment_method_types; card uses automatic_payment_methods
      ...(paymentMethod === "ach"
        ? { payment_method_types: ["us_bank_account"] }
        : { payment_method_types: ["card"] }),
    };

    // When the contractor has a connected Stripe account, create the session
    // directly ON that account (Direct Charges) so funds land in their bank
    // without passing through Sightline. When not yet onboarded, the session
    // is created on the platform account so payment still works.
    const requestOptions: Stripe.RequestOptions = connectedAccountId
      ? { stripeAccount: connectedAccountId }
      : {};

    const session = await stripe.checkout.sessions.create(sessionParams, requestOptions);
    return { url: session.url! };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Payment session failed. Please try again.";
    return { error: msg };
  }
}
