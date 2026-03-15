import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Job } from "@/types";
import TypeTags from "@/components/TypeTags";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function fmt$(n: number) {
  if (n >= 1000) return "$" + (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return "$" + Math.round(n).toLocaleString();
}

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  // Parallel queries
  const [
    { count: activeCount },
    { data: monthEstimates },
    { data: userJobIds },
    { data: recentJobs },
  ] = await Promise.all([
    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user!.id)
      .eq("status", "active"),
    supabase
      .from("estimates")
      .select("final_quote")
      .eq("user_id", user!.id)
      .gte("created_at", monthStart.toISOString()),
    supabase.from("jobs").select("id").eq("user_id", user!.id),
    supabase
      .from("jobs")
      .select("*")
      .eq("user_id", user!.id)
      .order("updated_at", { ascending: false })
      .returns<Job[]>(),
  ]);

  // Materials spend this month (via job IDs)
  const jobIds = userJobIds?.map((j) => j.id) ?? [];
  const { data: monthMaterials } =
    jobIds.length > 0
      ? await supabase
          .from("materials")
          .select("quantity_used, unit_cost")
          .in("job_id", jobIds)
          .gte("created_at", monthStart.toISOString())
      : { data: [] };

  const monthlyRevenue = (monthEstimates ?? []).reduce(
    (sum, e) => sum + Number(e.final_quote),
    0
  );
  const monthlyMaterials = (monthMaterials ?? []).reduce((sum, m) => {
    if (m.quantity_used !== null && m.unit_cost !== null)
      return sum + Number(m.quantity_used) * Number(m.unit_cost);
    return sum;
  }, 0);

  const allJobs = recentJobs ?? [];
  const recentThree = allJobs.slice(0, 3);
  const hasMore = allJobs.length > 3;

  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-8 pb-16">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <Link
            href="/jobs/new"
            className="bg-orange-500 text-white font-bold text-base px-5 py-3 rounded-xl active:scale-95 transition-transform"
          >
            + New Job
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-3 py-4 text-center">
            <p className="text-orange-500 text-3xl font-black leading-none mb-1">
              {activeCount ?? 0}
            </p>
            <p className="text-gray-400 text-xs uppercase tracking-wider">
              Active
            </p>
          </div>
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-3 py-4 text-center">
            <p className="text-orange-500 text-xl font-black leading-none mb-1">
              {fmt$(monthlyRevenue)}
            </p>
            <p className="text-gray-400 text-xs uppercase tracking-wider">
              Rev. Est.
            </p>
          </div>
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-3 py-4 text-center">
            <p className="text-orange-500 text-xl font-black leading-none mb-1">
              {fmt$(monthlyMaterials)}
            </p>
            <p className="text-gray-400 text-xs uppercase tracking-wider">
              Mat. Spend
            </p>
          </div>
        </div>

        {/* Recent Jobs */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold text-xl">Recent Jobs</h2>
          {hasMore && (
            <Link
              href="/jobs/all"
              className="text-orange-500 text-sm font-semibold"
            >
              All {allJobs.length} jobs →
            </Link>
          )}
        </div>

        {allJobs.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-gray-400 text-lg mb-6">
              No jobs yet — create your first one.
            </p>
            <Link
              href="/jobs/new"
              className="bg-orange-500 text-white font-bold text-lg px-8 py-4 rounded-xl active:scale-95 transition-transform inline-block"
            >
              + New Job
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {recentThree.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/jobs/${job.id}`}
                  className="block bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5 active:scale-95 transition-transform"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h2 className="text-white font-bold text-xl leading-tight">
                      {job.name}
                    </h2>
                    <span
                      className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full ${
                        job.status === "active"
                          ? "bg-orange-500/20 text-orange-400"
                          : job.status === "completed"
                          ? "bg-green-900/30 text-green-400"
                          : "bg-[#2a2a2a] text-gray-400"
                      }`}
                    >
                      {job.status === "on_hold" ? "On Hold" : job.status === "active" ? "Active" : "Done"}
                    </span>
                  </div>
                  <TypeTags types={job.types} />
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-gray-400 text-sm">{job.address}</p>
                    <p className="text-gray-500 text-xs">
                      {formatDate(job.updated_at)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
            {hasMore && (
              <li>
                <Link
                  href="/jobs/all"
                  className="flex items-center justify-center bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl py-4 text-orange-500 font-semibold active:scale-95 transition-transform"
                >
                  View all {allJobs.length} jobs →
                </Link>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
