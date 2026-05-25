import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Reports — Sightline" };

const REPORT_LINKS = [
  {
    href: "/reports",
    label: "Custom Report Builder",
    desc: "Generate professional PDF job reports with photos, materials, costs, and timelines.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    href: "/tax",
    label: "Tax Report",
    desc: "Summarize deductible expenses, mileage, and income by tax year for your accountant.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    href: "/profit",
    label: "Profitability Report",
    desc: "See profit and loss across all your jobs — materials, labor, quotes, and margins.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    href: "/mileage",
    label: "Mileage Export",
    desc: "Export IRS-ready mileage logs for all job-related drives. Import into TurboTax or give to your accountant.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4l3 3" />
      </svg>
    ),
  },
];

const chevron = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

export default function ReportsHubPage() {
  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 pt-6 pb-24">
      <div className="max-w-lg mx-auto flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports</h1>
          <p className="text-gray-500 text-sm mt-1">Export, analyze, and share your business data.</p>
        </div>

        <div className="flex flex-col gap-3">
          {REPORT_LINKS.map(({ href, label, desc, icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-4 bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4 active:scale-95 transition-transform"
            >
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-base">{label}</p>
                <p className="text-gray-500 text-sm leading-snug mt-0.5">{desc}</p>
              </div>
              {chevron}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
