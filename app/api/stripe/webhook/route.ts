import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { sendPushToUser } from "@/lib/push";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

// Service-role client — bypasses RLS for webhook writes
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = adminClient();

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId =
        subscription.metadata?.supabase_user_id ??
        (await getUserIdFromCustomer(subscription.customer as string));

      if (!userId) break;

      await supabase.from("subscriptions").upsert(
        {
          user_id: userId,
          stripe_customer_id: subscription.customer as string,
          stripe_subscription_id: subscription.id,
          status: subscription.status,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          current_period_end: (subscription as any).current_period_end
            ? new Date(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (subscription as any).current_period_end * 1000
              ).toISOString()
            : null,
        },
        { onConflict: "user_id" }
      );
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await supabase
        .from("subscriptions")
        .update({ status: "canceled", stripe_subscription_id: subscription.id })
        .eq("stripe_subscription_id", subscription.id);
      break;
    }

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      // ── Milestone payment ────────────────────────────────────────────────
      if (session.metadata?.milestone_id) {
        const milestoneId = session.metadata.milestone_id;
        const invoiceId   = session.metadata.invoice_id;
        const now = new Date().toISOString();

        // Mark the milestone paid
        await supabase
          .from("payment_milestones")
          .update({ status: "paid", paid_at: now })
          .eq("id", milestoneId);

        // Check if all milestones for this invoice are now paid
        const { data: remaining } = await supabase
          .from("payment_milestones")
          .select("id, status")
          .eq("invoice_id", invoiceId);

        const allPaid = (remaining ?? []).every((m) => m.status === "paid" || m.id === milestoneId);
        if (allPaid) {
          await supabase
            .from("invoices")
            .update({ status: "paid", paid_at: now })
            .eq("id", invoiceId);
        }

        // Notify contractor
        const { data: inv } = await supabase
          .from("invoices")
          .select("job_id, total_amount, jobs(user_id, name, client_id)")
          .eq("id", invoiceId)
          .single();
        if (inv) {
          const job = inv.jobs as unknown as { user_id: string; name: string; client_id: string | null } | null;
          if (job?.user_id) {
            let clientName = "Client";
            if (job.client_id) {
              const { data: cl } = await supabase.from("clients").select("name").eq("id", job.client_id).single();
              if (cl?.name) clientName = cl.name;
            }
            const { data: ms } = await supabase.from("payment_milestones").select("label, amount").eq("id", milestoneId).single();
            const invNum = `INV-${invoiceId.slice(0, 8).toUpperCase()}`;
            const amt = Number(ms?.amount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
            await sendPushToUser(job.user_id, {
              title: "Milestone Paid",
              body: `${clientName} paid ${ms?.label ?? "milestone"} on ${invNum} — $${amt}`,
              url: `/jobs`,
            });
          }
        }
        break;
      }

      // ── Full invoice payment ─────────────────────────────────────────────
      if (session.metadata?.invoice_id) {
        await supabase
          .from("invoices")
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("id", session.metadata.invoice_id);

        // Notify job owner
        const { data: inv } = await supabase
          .from("invoices")
          .select("job_id, total_amount, jobs(user_id, name, client_id)")
          .eq("id", session.metadata.invoice_id)
          .single();
        if (inv) {
          const job = inv.jobs as unknown as { user_id: string; name: string; client_id: string | null } | null;
          if (job?.user_id) {
            let clientName = "Client";
            if (job.client_id) {
              const { data: cl } = await supabase
                .from("clients")
                .select("name")
                .eq("id", job.client_id)
                .single();
              if (cl?.name) clientName = cl.name;
            }
            const invNum = `INV-${session.metadata.invoice_id.slice(0, 8).toUpperCase()}`;
            const amount = Number(inv.total_amount).toLocaleString("en-US", { minimumFractionDigits: 2 });
            await sendPushToUser(job.user_id, {
              title: "Invoice Paid",
              body: `${clientName} paid ${invNum} — $${amount}`,
              url: `/jobs`,
            });
          }
        }
        break;
      }

      // ── Subscription checkout ────────────────────────────────────────────
      const userId = session.client_reference_id;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      if (!userId || !subscriptionId) break;

      // Retrieve subscription to get full status + period
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      await supabase.from("subscriptions").upsert(
        {
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          status: subscription.status,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          current_period_end: (subscription as any).current_period_end
            ? new Date(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (subscription as any).current_period_end * 1000
              ).toISOString()
            : null,
        },
        { onConflict: "user_id" }
      );
      break;
    }

    case "invoice.payment_failed": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invoice = event.data.object as any;
      if (invoice.subscription) {
        await supabase
          .from("subscriptions")
          .update({ status: "past_due" })
          .eq("stripe_subscription_id", invoice.subscription as string);

        // Notify the account owner
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", invoice.subscription as string)
          .single();
        if (sub?.user_id) {
          await sendPushToUser(sub.user_id, {
            title: "Payment Failed",
            body: "Your Sightline subscription payment failed — update billing to keep access",
            url: "/subscribe",
          });
        }
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}

async function getUserIdFromCustomer(customerId: string): Promise<string | null> {
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return null;
  return (customer as Stripe.Customer).metadata?.supabase_user_id ?? null;
}
