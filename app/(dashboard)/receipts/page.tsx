import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

interface ReceiptRow {
  id: string;
  job_id: string;
  storage_path: string;
  vendor: string | null;
  amount: number | null;
  created_at: string;
  job_name: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function ReceiptsMasterPage({
  searchParams,
}: {
  searchParams: { sort?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get all job IDs for this user
  const { data: userJobs } = await supabase
    .from("jobs")
    .select("id, name")
    .eq("user_id", user!.id);

  const jobMap = Object.fromEntries(
    (userJobs ?? []).map((j) => [j.id, j.name])
  );
  const jobIds = Object.keys(jobMap);

  let receipts: ReceiptRow[] = [];
  if (jobIds.length > 0) {
    const { data } = await supabase
      .from("receipts")
      .select("id, job_id, storage_path, vendor, amount, created_at")
      .in("job_id", jobIds)
      .order("created_at", { ascending: false });

    receipts = (data ?? []).map((r) => ({
      ...r,
      job_name: jobMap[r.job_id] ?? "Unknown Job",
    }));
  }

  const sort = searchParams.sort ?? "date";

  const sorted = [...receipts].sort((a, b) => {
    if (sort === "job") {
      return a.job_name.localeCompare(b.job_name);
    }
    // default: date desc
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const total = receipts.reduce((sum, r) => sum + (r.amount ?? 0), 0);
  const withAmount = receipts.filter((r) => r.amount !== null).length;

  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-8 pb-16">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/jobs"
            className="text-gray-400 text-2xl leading-none active:scale-95 transition-transform min-w-[48px] min-h-[48px] flex items-center justify-center"
            aria-label="Back"
          >
            ←
          </Link>
          <h1 className="text-3xl font-bold text-white">All Receipts</h1>
        </div>

        {/* Total summary */}
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5 mb-6">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
            Total Across All Jobs
          </p>
          <p className="text-orange-500 text-5xl font-black leading-none mb-2">
            ${total.toFixed(2)}
          </p>
          <p className="text-gray-500 text-sm">
            {withAmount} receipt{withAmount !== 1 ? "s" : ""} with extracted totals
            {receipts.length !== withAmount && (
              <span> · {receipts.length - withAmount} unread</span>
            )}
          </p>
        </div>

        {/* Sort controls */}
        {receipts.length > 0 && (
          <div className="flex gap-2 mb-5">
            <Link
              href="/receipts?sort=date"
              className={`px-4 py-3 rounded-xl font-semibold text-sm transition-colors active:scale-95 ${
                sort === "date"
                  ? "bg-orange-500 text-white"
                  : "bg-[#1A1A1A] text-gray-400 border border-[#2a2a2a]"
              }`}
            >
              By Date
            </Link>
            <Link
              href="/receipts?sort=job"
              className={`px-4 py-3 rounded-xl font-semibold text-sm transition-colors active:scale-95 ${
                sort === "job"
                  ? "bg-orange-500 text-white"
                  : "bg-[#1A1A1A] text-gray-400 border border-[#2a2a2a]"
              }`}
            >
              By Job
            </Link>
          </div>
        )}

        {/* Receipt list */}
        {sorted.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl py-16 flex flex-col items-center gap-3">
            <p className="text-gray-500 text-sm">No receipts scanned yet</p>
            <Link
              href="/jobs"
              className="bg-orange-500 text-white font-bold text-base px-6 py-3 rounded-xl active:scale-95 transition-transform"
            >
              Scan your first receipt
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sorted.map((r) => (
              <Link
                key={r.id}
                href={`/jobs/${r.job_id}`}
                className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 flex items-center gap-4 active:scale-95 transition-transform"
              >
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-base truncate">
                    {r.vendor ?? "Receipt"}
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {r.job_name} · {formatDate(r.created_at)}
                  </p>
                </div>

                {/* Amount */}
                {r.amount !== null ? (
                  <span className="text-orange-500 font-bold text-lg shrink-0">
                    ${Number(r.amount).toFixed(2)}
                  </span>
                ) : (
                  <span className="text-gray-600 text-sm shrink-0">—</span>
                )}
              </Link>
            ))}

            {/* Footer total */}
            <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 flex justify-between items-center mt-1">
              <span className="text-gray-400 font-semibold">
                Total ({withAmount} receipts)
              </span>
              <span className="text-white font-bold text-xl">
                ${total.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
