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

async function getConnectedAccountId(jobId: string): Promise<string | null> {
  const supabase = adminClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("user_id")
    .eq("id", jobId)
    .single();
  if (!job?.user_id) return null;

  const { data: bp } = await supabase
    .from("business_profiles")
    .select("stripe_account_id, stripe_onboarded")
    .eq("user_id", job.user_id)
    .maybeSingle();

  return bp?.stripe_onboarded && bp?.stripe_account_id ? bp.stripe_account_id : null;
}

export async function createInvoiceCheckoutSession(
  invoiceId: string
): Promise<{ url?: string; error?: string }> {
  const supabase = adminClient();

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select("id, job_id, total_amount, status")
    .eq("id", invoiceId)
    .single();

  if (invErr || !invoice) return { error: "Invoice not found" };
  if (invoice.status === "paid") return { error: "Invoice already paid" };

  const { data: job } = await supabase
    .from("jobs")
    .select("name")
    .eq("id", invoice.job_id)
    .single();

  const connectedAccountId = await getConnectedAccountId(invoice.job_id);
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://sightline.one";
  const amountCents = Math.round(Number(invoice.total_amount) * 100);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: job?.name ? `Invoice — ${job.name}` : "Invoice Payment",
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      invoice_id: invoiceId,
      job_id: invoice.job_id,
    },
    ...(connectedAccountId && {
      payment_intent_data: {
        transfer_data: { destination: connectedAccountId },
      },
    }),
    success_url: `${origin}/pay/${invoiceId}?status=success`,
    cancel_url: `${origin}/pay/${invoiceId}?status=cancel`,
  });

  return { url: session.url! };
}

export async function createMilestoneCheckoutSession(
  milestoneId: string
): Promise<{ url?: string; error?: string }> {
  const supabase = adminClient();

  const { data: milestone } = await supabase
    .from("payment_milestones")
    .select("*, invoices(job_id, status)")
    .eq("id", milestoneId)
    .single();

  if (!milestone) return { error: "Milestone not found" };
  if (milestone.status === "paid") return { error: "Already paid" };

  const inv = milestone.invoices as { job_id: string; status: string } | null;
  if (!inv) return { error: "Invoice not found" };

  const { data: job } = await supabase
    .from("jobs")
    .select("name")
    .eq("id", inv.job_id)
    .single();

  const connectedAccountId = await getConnectedAccountId(inv.job_id);
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://sightline.one";
  const amountCents = Math.round(Number(milestone.amount) * 100);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: job?.name
              ? `${milestone.label} — ${job.name}`
              : milestone.label,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      milestone_id: milestoneId,
      invoice_id: milestone.invoice_id,
      job_id: inv.job_id,
    },
    ...(connectedAccountId && {
      payment_intent_data: {
        transfer_data: { destination: connectedAccountId },
      },
    }),
    success_url: `${origin}/pay/${milestone.invoice_id}?status=success`,
    cancel_url: `${origin}/pay/${milestone.invoice_id}?status=cancel`,
  });

  return { url: session.url! };
}
