import { createClient } from "@/lib/supabase/server";
import CalculatorClient from "./CalculatorClient";
import { parseAddress } from "@/lib/address-parser";
import { getRegionalCalcPricing } from "@/app/actions/regional-pricing";

export default async function CalculatorPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: jobs }, { data: biz }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, name")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("business_profiles")
      .select("address")
      .eq("user_id", user!.id)
      .maybeSingle(),
  ]);

  const location = parseAddress(biz?.address);
  const pricing = await getRegionalCalcPricing(location);

  const locationSource =
    location.city && location.state
      ? `${location.city}, ${location.state}`
      : location.state
      ? location.state
      : location.zip
      ? location.zip
      : null;

  return (
    <CalculatorClient
      jobs={jobs ?? []}
      pricing={pricing}
      locationSource={locationSource}
    />
  );
}
