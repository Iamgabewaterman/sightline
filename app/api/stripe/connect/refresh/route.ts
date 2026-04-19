import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://sightline.one";

export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get("account");
  if (!accountId) {
    return NextResponse.redirect(`${origin}/account`);
  }

  try {
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/api/stripe/connect/refresh?account=${accountId}`,
      return_url: `${origin}/account?connect=success`,
      type: "account_onboarding",
    });
    return NextResponse.redirect(accountLink.url);
  } catch {
    return NextResponse.redirect(`${origin}/account?connect=error`);
  }
}
