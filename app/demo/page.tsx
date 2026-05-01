"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { DEMO_JOBS } from "./_data";
import DemoCalculatorSection from "@/components/demo/DemoCalculatorSection";
import DemoMileageSection from "@/components/demo/DemoMileageSection";
import DemoReceiptsSection from "@/components/demo/DemoReceiptsSection";
import DemoInsightsSection from "@/components/demo/DemoInsightsSection";
import DemoImportSection from "@/components/demo/DemoImportSection";
import DemoSignupPrompt from "@/components/demo/DemoSignupPrompt";

type Section = "jobs" | "calculator" | "mileage" | "receipts" | "insights" | "import";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "jobs",       label: "Jobs" },
  { id: "calculator", label: "Calculator" },
  { id: "mileage",    label: "Mileage" },
  { id: "receipts",   label: "Receipts" },
  { id: "insights",   label: "Insights" },
  { id: "import",     label: "Import" },
];

const TYPE_LABELS: Record<string, string> = {
  drywall: "Drywall", framing: "Framing", plumbing: "Plumbing", paint: "Paint",
  trim: "Trim", roofing: "Roofing", tile: "Tile", flooring: "Flooring",
  electrical: "Electrical", hvac: "HVAC", concrete: "Concrete",
  landscaping: "Landscaping", decks_patios: "Decks & Patios", fencing: "Fencing",
};

export default function DemoPage() {
  const [active, setActive] = useState<Section>("jobs");
  const tabBarRef = useRef<HTMLDivElement>(null);

  const activeCount  = DEMO_JOBS.filter((j) => j.status === "active").length;
  const totalQuoted  = DEMO_JOBS.reduce((s, j) => s + j.quote.final_quote + j.quote.addons.reduce((a, b) => a + b.amount, 0), 0);
  const paidTotal    = DEMO_JOBS.reduce((s, j) => s + (j.invoice?.status === "paid" ? j.invoice.amount : 0), 0);

  function switchTab(id: Section) {
    setActive(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="min-h-screen bg-[#0F0F0F] pb-20">
      {/* Sticky tab bar */}
      <div
        ref={tabBarRef}
        className="sticky top-[52px] z-40 bg-[#0F0F0F] border-b border-[#1e1e1e] overflow-x-auto"
      >
        <div className="flex gap-0 min-w-max px-4 max-w-lg mx-auto">
          {SECTIONS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => switchTab(id)}
              className={`px-4 py-3.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                active === id
                  ? "border-orange-500 text-orange-500"
                  : "border-transparent text-gray-500 active:text-gray-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6">

        {/* ── JOBS ───────────────────────────────────────────────────────────── */}
        {active === "jobs" && (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-1">Demo Account</p>
                <h1 className="text-3xl font-bold text-white">Dashboard</h1>
              </div>
              <DemoSignupPrompt label="Create your first job">
                <div className="bg-[#1A1A1A] border border-[#2a2a2a] text-gray-400 font-bold text-base px-5 py-3 rounded-xl">
                  + New Job
                </div>
              </DemoSignupPrompt>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 text-center">
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1.5">Active</p>
                <p className="text-white font-bold text-2xl">{activeCount}</p>
              </div>
              <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 text-center">
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1.5">Quoted</p>
                <p className="text-orange-500 font-bold text-xl">${(totalQuoted / 1000).toFixed(1)}k</p>
              </div>
              <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 text-center">
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1.5">Paid</p>
                <p className="text-green-400 font-bold text-xl">${(paidTotal / 1000).toFixed(1)}k</p>
              </div>
            </div>

            {/* Job list */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-lg">Recent Jobs</h2>
              <span className="text-gray-600 text-sm">3 jobs</span>
            </div>
            <div className="flex flex-col gap-3 mb-10">
              {DEMO_JOBS.map((job) => {
                const quoteTotal = job.quote.final_quote + job.quote.addons.reduce((s, a) => s + a.amount, 0);
                return (
                  <Link
                    key={job.slug}
                    href={`/demo/jobs/${job.slug}`}
                    className="block bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5 active:scale-95 transition-transform"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <h3 className="text-white font-bold text-lg leading-tight">{job.name}</h3>
                      <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${
                        job.status === "completed" ? "bg-green-500/15 text-green-400" : "bg-orange-500/15 text-orange-400"
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
                      <span className="text-orange-500 font-bold text-sm">${(quoteTotal / 1000).toFixed(1)}k quote</span>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Feature nav prompts */}
            <div className="flex flex-col gap-3 mb-10">
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Explore more features</p>
              {SECTIONS.filter((s) => s.id !== "jobs").map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => switchTab(id)}
                  className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4 flex items-center justify-between active:scale-95 transition-transform"
                >
                  <span className="text-white font-semibold text-sm">{label}</span>
                  <span className="text-gray-600 text-lg">→</span>
                </button>
              ))}
            </div>

            {/* Signup CTA */}
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl px-6 py-8 text-center mb-6">
              <p className="text-orange-400 font-bold text-xs uppercase tracking-widest mb-2">Ready to try it?</p>
              <h3 className="text-white font-bold text-2xl mb-2">Built for contractors</h3>
              <p className="text-gray-400 text-sm mb-6 max-w-xs mx-auto">
                Track jobs, generate quotes, log labor and materials — all from your phone on the jobsite.
              </p>
              <Link href="/signup" className="inline-block bg-orange-500 text-white font-bold text-lg px-8 py-4 rounded-xl active:scale-95 transition-transform">
                Start Free Trial →
              </Link>
              <p className="text-gray-600 text-xs mt-4">No credit card required · 30-day free trial</p>
            </div>
          </>
        )}

        {/* ── CALCULATOR ─────────────────────────────────────────────────────── */}
        {active === "calculator" && <DemoCalculatorSection />}

        {/* ── MILEAGE ────────────────────────────────────────────────────────── */}
        {active === "mileage" && <DemoMileageSection />}

        {/* ── RECEIPTS ───────────────────────────────────────────────────────── */}
        {active === "receipts" && <DemoReceiptsSection />}

        {/* ── INSIGHTS ───────────────────────────────────────────────────────── */}
        {active === "insights" && <DemoInsightsSection />}

        {/* ── IMPORT ─────────────────────────────────────────────────────────── */}
        {active === "import" && <DemoImportSection />}

        {/* Bottom CTA on non-jobs sections */}
        {active !== "jobs" && (
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl px-6 py-7 text-center mt-6">
            <p className="text-white font-bold text-lg mb-1">Ready to use this for real?</p>
            <p className="text-gray-400 text-sm mb-5">30-day free trial — no credit card required.</p>
            <Link href="/signup" className="inline-block bg-orange-500 text-white font-bold text-base px-8 py-4 rounded-xl active:scale-95 transition-transform">
              Start Free Trial →
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}
