import { createClient } from "@/lib/supabase/server";
import { createCheckoutSession } from "@/app/actions/stripe";

export default async function SubscribePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", user!.id)
    .maybeSingle();

  // Calculate trial info
  const trialEndsAt = new Date(user!.created_at);
  trialEndsAt.setMonth(trialEndsAt.getMonth() + 3);
  const now = new Date();
  const onTrial = now < trialEndsAt;
  const daysLeft = Math.max(
    0,
    Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );

  const isActive = sub?.status === "active" || sub?.status === "trialing";

  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-8 pb-16">
      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Sightline Pro</h1>
        <p className="text-gray-400 mb-8">Every job. One view.</p>

        {isActive ? (
          <div className="bg-green-900/30 border border-green-800 rounded-xl px-5 py-5 mb-6">
            <p className="text-green-400 font-bold text-lg">
              Subscription active
            </p>
            {sub?.current_period_end && (
              <p className="text-gray-400 text-sm mt-1">
                Renews{" "}
                {new Date(sub.current_period_end).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            )}
          </div>
        ) : onTrial ? (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl px-5 py-5 mb-6">
            <p className="text-orange-400 font-bold text-lg">
              Free trial — {daysLeft} days left
            </p>
            <p className="text-gray-400 text-sm mt-1">
              Subscribe before your trial ends to keep access.
            </p>
          </div>
        ) : (
          <div className="bg-red-950 border border-red-800 rounded-xl px-5 py-5 mb-6">
            <p className="text-red-400 font-bold text-lg">Trial expired</p>
            <p className="text-gray-400 text-sm mt-1">
              Subscribe to restore full access.
            </p>
          </div>
        )}

        {/* Pricing card */}
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-6 mb-6">
          <div className="flex items-end gap-1 mb-4">
            <span className="text-orange-500 text-5xl font-black">$50</span>
            <span className="text-gray-400 text-lg mb-1">/month</span>
          </div>
          <ul className="flex flex-col gap-3 text-sm text-gray-300">
            {[
              "Unlimited jobs",
              "Photo uploads — Before, During, After, Damages",
              "Material tracking & profitability bar",
              "AI-powered receipt OCR",
              "Labor log",
              "Quote calculator",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span className="text-orange-500 font-bold">✓</span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        {!isActive && (
          <form action={createCheckoutSession}>
            <button
              type="submit"
              className="w-full bg-orange-500 text-white font-bold text-lg py-5 rounded-xl active:scale-95 transition-transform"
            >
              Subscribe — $50/month
            </button>
          </form>
        )}

        <p className="text-gray-600 text-xs text-center mt-4">
          Secured by Stripe. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
