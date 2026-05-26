import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createCheckoutSession } from "@/app/actions/stripe";
import SignOutButton from "@/components/SignOutButton";

function fmt$(n: number) {
  if (n >= 1000) return "$" + (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return "$" + Math.round(n).toLocaleString();
}

export default async function SubscribePage({
  searchParams,
}: {
  searchParams: { reason?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const isJobGate = searchParams.reason === "job_gate";

  let accomplishments = null;
  if (isJobGate) {
    const [
      { count: jobCount },
      { data: invoices },
      { count: matCount },
      { count: receiptCount },
    ] = await Promise.all([
      supabase.from("jobs").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "completed"),
      supabase.from("invoices").select("total_amount").eq("user_id", user.id),
      supabase.from("materials").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("receipts").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]);

    const totalRevenue = (invoices ?? []).reduce((s, inv) => s + Number(inv.total_amount), 0);
    accomplishments = {
      jobsDone: jobCount ?? 0,
      revenue: totalRevenue,
      materials: matCount ?? 0,
      receipts: receiptCount ?? 0,
    };
  }

  return (
    <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-6">

        {isJobGate ? (
          <>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-orange-500/15 border border-orange-500/30 flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 11 12 14 22 4"/>
                  <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white mb-3 leading-tight">
                You&apos;ve completed 3 jobs with Sightline.
              </h1>
              <p className="text-gray-400 text-base leading-relaxed">
                You know what it can do. Keep your data and momentum going for $49.99/month.
              </p>
            </div>

            {accomplishments && (
              <div className="w-full bg-[#1A1A1A] border border-[#2a2a2a] rounded-2xl px-5 py-5">
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-4">What you&apos;ve built</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-orange-500 font-black text-2xl leading-none">{accomplishments.jobsDone}</p>
                    <p className="text-gray-400 text-xs mt-1">Jobs completed</p>
                  </div>
                  <div>
                    <p className="text-orange-500 font-black text-2xl leading-none">{fmt$(accomplishments.revenue)}</p>
                    <p className="text-gray-400 text-xs mt-1">Revenue tracked</p>
                  </div>
                  <div>
                    <p className="text-orange-500 font-black text-2xl leading-none">{accomplishments.materials}</p>
                    <p className="text-gray-400 text-xs mt-1">Materials logged</p>
                  </div>
                  <div>
                    <p className="text-orange-500 font-black text-2xl leading-none">{accomplishments.receipts}</p>
                    <p className="text-gray-400 text-xs mt-1">Receipts scanned</p>
                  </div>
                </div>
              </div>
            )}

            <form action={createCheckoutSession} className="w-full">
              <button
                type="submit"
                className="w-full bg-orange-500 text-white font-bold text-lg py-5 rounded-xl active:scale-95 transition-transform"
              >
                Keep Going — $49.99/month
              </button>
            </form>

            <p className="text-gray-600 text-xs text-center">
              All your data stays exactly where it is. Cancel anytime.
            </p>
          </>
        ) : (
          <>
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
          </>
        )}

        <SignOutButton />
      </div>
    </div>
  );
}
