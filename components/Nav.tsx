import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "./LogoutButton";

export default async function Nav() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <nav className="bg-[#141414] border-b border-[#2a2a2a] px-4 py-3 flex items-center justify-between">
      <Link href={user ? "/jobs" : "/"} className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0" />
        <span className="text-white font-black text-2xl tracking-tight leading-none">
          Sightline
        </span>
      </Link>
      {user && (
        <div className="flex items-center gap-3">
          <Link
            href="/jobs"
            className="text-white font-semibold text-base bg-[#1A1A1A] border border-[#2a2a2a] px-5 py-3 rounded-xl active:scale-95 transition-transform"
          >
            Dashboard
          </Link>
          <LogoutButton />
        </div>
      )}
    </nav>
  );
}
