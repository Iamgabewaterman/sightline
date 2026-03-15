import { createClient } from "@/lib/supabase/server";
import CalculatorClient from "./CalculatorClient";
import { getCalculatorPrefs } from "@/app/actions/calculator-prefs";

export default async function CalculatorPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: lastDrywall }, { data: jobs }, prefs] = await Promise.all([
    supabase
      .from("materials")
      .select("unit_cost")
      .ilike("name", "%drywall%")
      .not("unit_cost", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("jobs")
      .select("id, name")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    getCalculatorPrefs(),
  ]);

  return (
    <CalculatorClient
      defaultSheetCost={lastDrywall?.unit_cost?.toString() ?? ""}
      jobs={jobs ?? []}
      initialPrefs={prefs}
    />
  );
}
