import { createClient } from "@/lib/supabase/server";
import CalculatorClient from "./CalculatorClient";

export default async function CalculatorPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, name")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  return <CalculatorClient jobs={jobs ?? []} />;
}
