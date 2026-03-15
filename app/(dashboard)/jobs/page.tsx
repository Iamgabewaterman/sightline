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

export default async function JobsPage() {
  const supabase = createClient();
  const { data: jobs } = await supabase
    .from("jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Job[]>();

  return (
    <div className="min-h-screen bg-black px-4 py-8">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Jobs</h1>
          <Link
            href="/jobs/new"
            className="bg-white text-black font-bold text-base px-5 py-3 rounded-xl active:scale-95 transition-transform"
          >
            + New Job
          </Link>
        </div>

        {/* Job list */}
        {!jobs || jobs.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-zinc-500 text-lg mb-6">
              No jobs yet — create your first one.
            </p>
            <Link
              href="/jobs/new"
              className="bg-white text-black font-bold text-lg px-8 py-4 rounded-xl active:scale-95 transition-transform inline-block"
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
                  className="block bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-5 active:scale-95 transition-transform"
                >
                  <h2 className="text-white font-bold text-xl leading-tight mb-3">
                    {job.name}
                  </h2>
                  <TypeTags types={job.types} />
                  <p className="text-zinc-400 text-sm mt-3">{job.address}</p>
                  <p className="text-zinc-600 text-xs mt-2">
                    {formatDate(job.created_at)}
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
