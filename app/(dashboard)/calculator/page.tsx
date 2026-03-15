import { createClient } from "@/lib/supabase/server";
import CalculatorClient from "./CalculatorClient";
import { getCalculatorPrefs } from "@/app/actions/calculator-prefs";
import { getRegionalCalcPricing } from "@/app/actions/regional-pricing";
import { parseAddress } from "@/lib/address-parser";

export default async function CalculatorPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: jobs }, prefs, { data: recentJob }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, name")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    getCalculatorPrefs(),
    // Get the user's most recent job with an address for location context
    supabase
      .from("jobs")
      .select("address")
      .eq("user_id", user!.id)
      .not("address", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const location = parseAddress(recentJob?.address);
  const regionalPricing = await getRegionalCalcPricing(location);

  return (
    <CalculatorClient
      jobs={jobs ?? []}
      initialPrefs={prefs}
      regionalPricing={regionalPricing}
    />
  );
}
