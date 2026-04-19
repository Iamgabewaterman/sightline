import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import AccountAvatarSection from "./AccountAvatarSection";
import ConnectBankButton from "./ConnectBankButton";
import { verifyConnectAccount } from "@/app/actions/stripe-connect";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: { connect?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // If returning from Stripe Connect onboarding, re-verify
  if (searchParams.connect === "success") {
    await verifyConnectAccount();
  }

  // Fetch connect status
  const { data: bp } = await supabase
    .from("business_profiles")
    .select("stripe_onboarded")
    .eq("user_id", user.id)
    .maybeSingle();

  const onboarded = bp?.stripe_onboarded ?? false;

  const rowClass =
    "flex items-center justify-between bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4 active:scale-95 transition-transform";
  const chevron = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );

  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 pt-6 pb-8">
      <div className="max-w-lg mx-auto flex flex-col gap-5">
        <h1 className="text-2xl font-bold text-white">Account</h1>

        {/* Avatar + name */}
        <AccountAvatarSection />

        {/* Payouts */}
        <div>
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2 px-1">Payouts</p>
          <ConnectBankButton onboarded={onboarded} />
        </div>

        {/* Links */}
        <div className="flex flex-col gap-3">
          <Link href="/subscribe" className={rowClass}>
            <span className="text-white font-semibold text-base">Billing</span>
            {chevron}
          </Link>
          <Link href="/settings" className={rowClass}>
            <span className="text-white font-semibold text-base">Settings</span>
            {chevron}
          </Link>
          <Link href="/business-profile" className={rowClass}>
            <span className="text-white font-semibold text-base">Business Profile</span>
            {chevron}
          </Link>
        </div>

        {/* Sign Out */}
        <form action={signOut}>
          <button
            type="submit"
            className="w-full flex items-center justify-between bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4 active:scale-95 transition-transform"
          >
            <span className="text-red-400 font-semibold text-base">Sign Out</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="#F87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
