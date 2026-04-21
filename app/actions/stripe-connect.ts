"use server";

import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

const origin = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://sightline.one";

export async function createConnectOnboardingLink(): Promise<{ url?: string; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  try {
    const admin = createAdminClient();
    const { data: bp } = await admin
      .from("business_profiles")
      .select("stripe_account_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let accountId = bp?.stripe_account_id as string | null;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { supabase_user_id: user.id },
      });
      accountId = account.id;

      await admin
        .from("business_profiles")
        .upsert(
          { user_id: user.id, stripe_account_id: accountId, stripe_onboarded: false },
          { onConflict: "user_id" }
        );
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin()}/api/stripe/connect/refresh?account=${accountId}`,
      return_url: `${origin()}/account?connected=true`,
      type: "account_onboarding",
    });

    return { url: accountLink.url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to start bank connection";
    return { error: msg };
  }
}

export async function createManagePayoutsLink(): Promise<{ url?: string; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  try {
    const { data: bp } = await supabase
      .from("business_profiles")
      .select("stripe_account_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const accountId = bp?.stripe_account_id as string | null;
    if (!accountId) return { error: "No connected account found" };

    const loginLink = await stripe.accounts.createLoginLink(accountId);
    return { url: loginLink.url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to open payout dashboard";
    return { error: msg };
  }
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
