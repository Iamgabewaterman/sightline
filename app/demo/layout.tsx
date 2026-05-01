import Link from "next/link";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Orange demo banner */}
      <div className="sticky top-0 z-50 bg-orange-500 px-4 py-3 flex items-center justify-between gap-3">
        <p className="text-white font-semibold text-sm leading-tight min-w-0">
          <span className="font-black">Live demo</span>
          <span className="hidden sm:inline"> — Start your 30-day free trial to use Sightline with your own jobs</span>
        </p>
        <Link
          href="/signup"
          className="shrink-0 bg-white text-orange-600 font-bold text-sm px-4 py-2 rounded-xl active:scale-95 transition-transform whitespace-nowrap"
        >
          Start Free Trial →
        </Link>
      </div>
      {children}
    </>
  );
}
