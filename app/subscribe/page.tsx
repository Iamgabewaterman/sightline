import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createCheckoutSession } from "@/app/actions/stripe";
import SignOutButton from "@/components/SignOutButton";

export default async function SubscribePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // No user at all → go to login
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-3">Your free trial has ended.</h1>
          <p className="text-gray-400 text-base leading-relaxed">
            Renew to keep access to all your jobs, quotes, and data — nothing is deleted.
          </p>
        </div>

        <form action={createCheckoutSession} className="w-full">
          <button
            type="submit"
            className="w-full bg-orange-500 text-white font-bold text-lg py-5 rounded-xl active:scale-95 transition-transform"
          >
            Renew Subscription — $49.99/month
          </button>
        </form>

        <SignOutButton />
      </div>
    </div>
  );
}
