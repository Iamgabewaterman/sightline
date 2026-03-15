import Link from "next/link";

export default function Nav() {
  return (
    <nav className="bg-black border-b border-zinc-800 px-4 py-4 flex items-center justify-between">
      <Link href="/" className="text-white font-bold text-xl tracking-tight">
        Sightline
      </Link>
      <Link
        href="/jobs"
        className="text-white font-semibold text-base bg-zinc-900 border border-zinc-700 px-5 py-2 rounded-xl active:scale-95 transition-transform"
      >
        Jobs
      </Link>
    </nav>
  );
}
