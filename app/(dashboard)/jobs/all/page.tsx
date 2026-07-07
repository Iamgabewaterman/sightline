import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Job } from "@/types";
import TypeTags from "@/components/TypeTags";
import AllJobsClient from "./AllJobsClient";

export default async function AllJobsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, name, types, address, status, updated_at, client_id, job_number")
    .eq("user_id", user!.id)
    .order("updated_at", { ascending: false })
    .returns<Job[]>();

  // Fetch client names + saved-quote margins in parallel.
  const clientIds = Array.from(new Set((jobs ?? []).filter((j) => j.client_id).map((j) => j.client_id!)));
  const [{ data: clients }, { data: estimates }] = await Promise.all([
    clientIds.length > 0
      ? supabase.from("clients").select("id, name").in("id", clientIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    supabase.from("estimates").select("job_id, profit_margin_pct").eq("user_id", user!.id).eq("type", "job_quote"),
  ]);

  const clientMap = new Map((clients ?? []).map((c) => [c.id, c.name]));
  const marginMap = new Map((estimates ?? []).map((e) => [e.job_id, Number(e.profit_margin_pct)]));

  const enriched = (jobs ?? []).map((j) => ({
    ...j,
    clientName: j.client_id ? (clientMap.get(j.client_id) ?? null) : null,
    margin: marginMap.has(j.id) ? (marginMap.get(j.id) as number) : null,
  }));

  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-8 pb-16">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/jobs"
            className="text-gray-400 text-2xl leading-none active:scale-95 transition-transform min-w-[48px] min-h-[48px] flex items-center justify-center"
            aria-label="Back"
          >
            ←
          </Link>
          <h1 className="text-3xl font-bold text-white">All Jobs</h1>
        </div>

        <AllJobsClient jobs={enriched} />
      </div>
    </div>
  );
}
