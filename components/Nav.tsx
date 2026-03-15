import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "./LogoutButton";

export default async function Nav() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <nav className="bg-black border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
      <Link href={user ? "/jobs" : "/"} className="text-white font-black text-2xl tracking-tight leading-none">
        Sightline
      </Link>
      {user && (
        <div className="flex items-center gap-3">
          <Link
            href="/jobs"
            className="text-white font-semibold text-base bg-zinc-900 border border-zinc-700 px-5 py-3 rounded-xl active:scale-95 transition-transform"
          >
            Jobs
          </Link>
          <LogoutButton />
        </div>
      )}
    </nav>
  );
}
