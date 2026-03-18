import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import GlobalSearch from "@/components/GlobalSearch";

export default async function Nav() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <nav className="nav-safe-top bg-[#141414] border-b border-[#2a2a2a]">
      <div className="relative px-4 py-2.5 flex items-center justify-center">
        <Link href={user ? "/jobs" : "/"} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
          <span className="text-white font-black text-xl tracking-tight leading-none">
            Sightline
          </span>
        </Link>
        {user && (
          <div className="absolute right-1">
            <GlobalSearch />
          </div>
        )}
      </div>
    </nav>
  );
}
