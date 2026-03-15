import { createClient } from "@/lib/supabase/server";
import CalculatorClient from "./CalculatorClient";

export default async function CalculatorPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Most recent drywall sheet cost from any completed job's materials
  const { data: lastDrywall } = await supabase
    .from("materials")
    .select("unit_cost")
    .ilike("name", "%drywall%")
    .not("unit_cost", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // User's jobs for "Save to Job"
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, name")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <CalculatorClient
      defaultSheetCost={lastDrywall?.unit_cost?.toString() ?? ""}
      jobs={jobs ?? []}
    />
  );
}
