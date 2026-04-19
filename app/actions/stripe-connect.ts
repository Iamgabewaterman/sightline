"use server";

import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

const origin = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://sightline.one";

export async function createConnectOnboardingLink(): Promise<{ url?: string; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: bp } = await supabase
    .from("business_profiles")
    .select("stripe_account_id")
    .eq("user_id", user.id)
    .maybeSingle();

  let accountId = bp?.stripe_account_id as string | null;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      metadata: { supabase_user_id: user.id },
    });
    accountId = account.id;

    await supabase
      .from("business_profiles")
      .upsert(
        { user_id: user.id, stripe_account_id: accountId, stripe_onboarded: false },
        { onConflict: "user_id" }
      );
  }

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin()}/api/stripe/connect/refresh?account=${accountId}`,
    return_url: `${origin()}/account?connect=success`,
    type: "account_onboarding",
  });

  return { url: accountLink.url };
}

export async function verifyConnectAccount(): Promise<{ onboarded: boolean; accountId: string | null }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { onboarded: false, accountId: null };

  const { data: bp } = await supabase
    .from("business_profiles")
    .select("stripe_account_id, stripe_onboarded")
    .eq("user_id", user.id)
    .maybeSingle();

  const accountId = (bp?.stripe_account_id as string | null) ?? null;
  if (!accountId) return { onboarded: false, accountId: null };

  // Already verified
  if (bp?.stripe_onboarded) return { onboarded: true, accountId };

  // Check with Stripe
  try {
    const account = await stripe.accounts.retrieve(accountId);
    if (account.charges_enabled) {
      await supabase
        .from("business_profiles")
        .update({ stripe_onboarded: true })
        .eq("user_id", user.id);
      return { onboarded: true, accountId };
    }
  } catch {
    // Account may not exist yet — ignore
  }

  return { onboarded: false, accountId };
}
