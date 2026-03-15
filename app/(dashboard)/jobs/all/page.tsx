import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Job } from "@/types";
import TypeTags from "@/components/TypeTags";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function AllJobsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: jobs } = await supabase
    .from("jobs")
    .select("*")
    .eq("user_id", user!.id)
    .order("updated_at", { ascending: false })
    .returns<Job[]>();

  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-8 pb-16">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/jobs"
            className="text-gray-400 text-2xl leading-none active:scale-95 transition-transform min-w-[48px] min-h-[48px] flex items-center justify-center"
            aria-label="Back"
          >
            ←
          </Link>
          <h1 className="text-3xl font-bold text-white">All Jobs</h1>
        </div>

        {!jobs || jobs.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-gray-400 text-lg mb-6">No jobs yet.</p>
            <Link
              href="/jobs/new"
              className="bg-orange-500 text-white font-bold text-lg px-8 py-4 rounded-xl active:scale-95 transition-transform inline-block"
            >
              + New Job
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {jobs.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/jobs/${job.id}`}
                  className="block bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5 active:scale-95 transition-transform"
                >
                  <h2 className="text-white font-bold text-xl leading-tight mb-3">
                    {job.name}
                  </h2>
                  <TypeTags types={job.types} />
                  <p className="text-gray-400 text-sm mt-3">{job.address}</p>
                  <p className="text-gray-500 text-xs mt-2">
                    {formatDate(job.updated_at)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
