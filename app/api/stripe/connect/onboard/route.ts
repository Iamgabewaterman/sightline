import { NextResponse } from "next/server";
import { createConnectOnboardingLink } from "@/app/actions/stripe-connect";

export async function POST() {
  const result = await createConnectOnboardingLink();
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ url: result.url });
}
