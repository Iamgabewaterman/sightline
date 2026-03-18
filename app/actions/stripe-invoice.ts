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
    success_url: `${origin}/pay/${invoiceId}?status=success`,
    cancel_url: `${origin}/pay/${invoiceId}?status=cancel`,
  });

  return { url: session.url! };
}
