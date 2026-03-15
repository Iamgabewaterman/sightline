import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Job } from "@/types";
import TypeTags from "@/components/TypeTags";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function JobDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", params.id)
    .single<Job>();

  if (!job) notFound();

  return (
    <div className="min-h-screen bg-black px-4 py-8">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Link
              href="/jobs"
              className="text-zinc-400 text-2xl leading-none active:scale-95 transition-transform"
              aria-label="Back"
            >
              ←
            </Link>
            <h1 className="text-3xl font-bold text-white leading-tight">
              {job.name}
            </h1>
          </div>
          <button
            disabled
            className="shrink-0 text-zinc-500 border border-zinc-700 font-semibold text-sm px-4 py-2 rounded-xl cursor-not-allowed"
          >
            Edit
          </button>
        </div>

        {/* Detail cards */}
        <div className="flex flex-col gap-4">
          {/* Types */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4">
            <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-3">
              Job Type
            </p>
            <TypeTags types={job.types} />
          </div>

          <DetailRow label="Address" value={job.address} />
          <DetailRow label="Created" value={formatDate(job.created_at)} />
          {job.notes && <DetailRow label="Notes" value={job.notes} multiline />}
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4">
      <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className={`text-white text-lg ${multiline ? "whitespace-pre-wrap" : ""}`}>
        {value}
      </p>
    </div>
  );
}
