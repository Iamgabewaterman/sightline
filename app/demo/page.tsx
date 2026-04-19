import Link from "next/link";
import { DEMO_JOBS } from "./_data";

const TYPE_LABELS: Record<string, string> = {
  drywall: "Drywall", framing: "Framing", plumbing: "Plumbing", paint: "Paint",
  trim: "Trim", roofing: "Roofing", tile: "Tile", flooring: "Flooring",
  electrical: "Electrical", hvac: "HVAC", concrete: "Concrete",
  landscaping: "Landscaping", decks_patios: "Decks & Patios", fencing: "Fencing",
};

export default function DemoPage() {
  const activeCount = DEMO_JOBS.filter((j) => j.status === "active").length;
  const totalQuoted = DEMO_JOBS.reduce((s, j) => {
    const addons = j.quote.addons.reduce((a, b) => a + b.amount, 0);
    return s + j.quote.final_quote + addons;
  }, 0);
  const paidTotal = DEMO_JOBS.reduce((s, j) => s + (j.invoice?.status === "paid" ? j.invoice.amount : 0), 0);

  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-8 pb-16">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-1">Demo Account</p>
            <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          </div>
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] text-gray-500 font-bold text-base px-5 py-3 rounded-xl opacity-50 cursor-not-allowed select-none">
            + New Job
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 text-center">
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1.5">Active</p>
            <p className="text-white font-bold text-2xl">{activeCount}</p>
          </div>
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 text-center">
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1.5">Quoted</p>
            <p className="text-orange-500 font-bold text-xl">
              ${(totalQuoted / 1000).toFixed(1)}k
            </p>
          </div>
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 text-center">
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1.5">Paid</p>
            <p className="text-green-400 font-bold text-xl">
              ${(paidTotal / 1000).toFixed(1)}k
            </p>
          </div>
        </div>

        {/* Jobs */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold text-lg">Recent Jobs</h2>
          <span className="text-gray-600 text-sm">3 jobs</span>
        </div>
        <div className="flex flex-col gap-3 mb-10">
          {DEMO_JOBS.map((job) => {
            const addons = job.quote.addons.reduce((s, a) => s + a.amount, 0);
            const quoteTotal = job.quote.final_quote + addons;
            return (
              <Link
                key={job.slug}
                href={`/demo/jobs/${job.slug}`}
                className="block bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5 active:scale-95 transition-transform"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="text-white font-bold text-lg leading-tight">{job.name}</h3>
                  <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${
                    job.status === "completed"
                      ? "bg-green-500/15 text-green-400"
                      : "bg-orange-500/15 text-orange-400"
                  }`}>
                    {job.status === "completed" ? "Completed" : "Active"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {job.types.map((t) => (
                    <span key={t} className="text-xs font-semibold uppercase tracking-wider text-white bg-[#292929] px-3 py-1 rounded-full">
                      {TYPE_LABELS[t] ?? t}
                    </span>
                  ))}
                </div>
                <p className="text-gray-400 text-sm mb-2">{job.address}</p>
                <div className="flex items-center justify-between pt-2 border-t border-[#242424]">
                  <span className="text-gray-500 text-xs">Created {job.created_at}</span>
                  <span className="text-orange-500 font-bold text-sm">
                    ${(quoteTotal / 1000).toFixed(1)}k quote
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* CTA */}
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl px-6 py-8 text-center">
          <p className="text-orange-400 font-bold text-xs uppercase tracking-widest mb-2">Ready to try it?</p>
          <h3 className="text-white font-bold text-2xl mb-2">Built for contractors</h3>
          <p className="text-gray-400 text-sm mb-6 max-w-xs mx-auto">
            Track jobs, generate quotes, log labor and materials — all from your phone on the jobsite.
          </p>
          <Link
            href="/signup"
            className="inline-block bg-orange-500 text-white font-bold text-lg px-8 py-4 rounded-xl active:scale-95 transition-transform"
          >
            Start Free Trial →
          </Link>
          <p className="text-gray-600 text-xs mt-4">No credit card required · 90-day free trial</p>
        </div>

      </div>
    </div>
  );
}
