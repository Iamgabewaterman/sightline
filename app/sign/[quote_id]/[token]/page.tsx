import { createClient } from "@supabase/supabase-js";
import SignaturePage from "./SignaturePage";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export default async function SignRoute({
  params,
}: {
  params: { quote_id: string; token: string };
}) {
  const supabase = adminClient();

  // Validate estimate + token
  const { data: estimate } = await supabase
    .from("estimates")
    .select(
      "id, user_id, job_id, material_total, labor_total, profit_margin_pct, final_quote, addons, quote_status, signed_at, signed_by_name, signature_token"
    )
    .eq("id", params.quote_id)
    .eq("signature_token", params.token)
    .single();

  if (!estimate) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Link</h1>
          <p className="text-gray-500 text-base">
            This signature link is invalid or has expired. Please contact the contractor for a new link.
          </p>
        </div>
      </div>
    );
  }

  if (estimate.quote_status === "accepted") {
    const signedDate = estimate.signed_at
      ? new Date(estimate.signed_at).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : "";
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Already Signed</h1>
          <p className="text-gray-500 text-base">
            This quote was accepted by {estimate.signed_by_name} on {signedDate}.
          </p>
        </div>
      </div>
    );
  }

  // Fetch job
  const { data: job } = await supabase
    .from("jobs")
    .select("id, name, address, types")
    .eq("id", estimate.job_id)
    .single();

  // Fetch business profile + logo
  const { data: bp } = await supabase
    .from("business_profiles")
    .select("business_name, owner_name, license_number, address, phone, email, logo_path")
    .eq("user_id", estimate.user_id)
    .maybeSingle();

  let logoUrl: string | null = null;
  if (bp?.logo_path) {
    const { data: signed } = await supabase.storage
      .from("business-logos")
      .createSignedUrl(bp.logo_path, 3600);
    logoUrl = signed?.signedUrl ?? null;
  }

  const addonsTotal = ((estimate.addons as { name: string; amount: number }[]) ?? []).reduce(
    (s, a) => s + Number(a.amount),
    0
  );

  return (
    <SignaturePage
      estimateId={estimate.id}
      token={params.token}
      jobName={job?.name ?? ""}
      jobAddress={job?.address ?? ""}
      jobTypes={(job?.types ?? []) as string[]}
      materialsTotal={Number(estimate.material_total)}
      laborTotal={Number(estimate.labor_total)}
      profitMarginPct={Number(estimate.profit_margin_pct)}
      profitAmount={Number(estimate.material_total + estimate.labor_total) * (Number(estimate.profit_margin_pct) / 100)}
      addons={(estimate.addons as { name: string; amount: number }[]) ?? []}
      grandTotal={Number(estimate.final_quote) + addonsTotal}
      businessName={bp?.business_name ?? null}
      licenseNumber={bp?.license_number ?? null}
      logoUrl={logoUrl}
    />
  );
}
