import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { data: bp } = await admin
    .from("business_profiles")
    .select("stripe_account_id, stripe_onboarded")
    .eq("user_id", user.id)
    .maybeSingle();

  const accountId = bp?.stripe_account_id as string | null;
  if (!accountId) {
    return NextResponse.json({ connected: false, payouts_enabled: false, charges_enabled: false, requirements: [] });
  }

  try {
    const account = await stripe.accounts.retrieve(accountId);
    const payouts_enabled = account.payouts_enabled ?? false;
    const charges_enabled = account.charges_enabled ?? false;
    const requirements = account.requirements?.currently_due ?? [];

    // Sync onboarded flag if newly verified
    if (charges_enabled && !bp?.stripe_onboarded) {
      await admin
        .from("business_profiles")
        .update({ stripe_onboarded: true })
        .eq("user_id", user.id);
    }

    return NextResponse.json({ connected: true, payouts_enabled, charges_enabled, requirements });
  } catch {
    return NextResponse.json({ connected: false, payouts_enabled: false, charges_enabled: false, requirements: [] });
  }
}
