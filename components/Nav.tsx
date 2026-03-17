import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Nav() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <nav className="nav-safe-top bg-[#141414] border-b border-[#2a2a2a]">
      <div className="px-4 py-2.5 flex items-center justify-between">
        <Link href={user ? "/jobs" : "/"} className="flex items-center gap-2 shrink-0">
          <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
          <span className="text-white font-black text-xl tracking-tight leading-none">
            Sightline
          </span>
        </Link>

        {user && (
          <Link
            href="/account"
            aria-label="Account"
            className="w-10 h-10 flex items-center justify-center rounded-xl active:opacity-70 transition-opacity"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </Link>
        )}
      </div>
    </nav>
  );
}
