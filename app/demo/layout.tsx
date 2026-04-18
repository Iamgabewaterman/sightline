import Link from "next/link";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Demo banner — fixed at top */}
      <div className="sticky top-0 z-40 bg-[#111] border-b border-[#2a2a2a] px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-orange-500 font-black text-lg tracking-tight shrink-0">Sightline</span>
          <span className="bg-orange-500/20 text-orange-400 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0">
            Demo
          </span>
          <span className="text-gray-600 text-xs hidden sm:block truncate">
            · Sample data only. No account needed.
          </span>
        </div>
        <Link
          href="/signup"
          className="shrink-0 bg-orange-500 text-white font-bold text-sm px-4 py-2.5 rounded-xl active:scale-95 transition-transform whitespace-nowrap"
        >
          Start Free Trial →
        </Link>
      </div>
      {children}
    </>
  );
}
