import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AccountDropdown from "./AccountDropdown";

export default async function Nav() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <nav
      className="bg-[#141414] border-b border-[#2a2a2a] px-3 flex items-center justify-between"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 10px)",
        paddingBottom: "10px",
      }}
    >
      <Link href={user ? "/jobs" : "/"} className="flex items-center gap-2 shrink-0">
        <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
        <span className="text-white font-black text-xl tracking-tight leading-none">
          Sightline
        </span>
      </Link>
      {user && (
        <div className="flex items-center gap-2">
          <Link
            href="/jobs"
            className="text-white font-semibold text-sm bg-[#1A1A1A] border border-[#2a2a2a] px-3 py-2 rounded-xl active:scale-95 transition-transform whitespace-nowrap"
          >
            Dashboard
          </Link>
          <Link
            href="/receipts"
            className="text-white font-semibold text-sm bg-[#1A1A1A] border border-[#2a2a2a] px-3 py-2 rounded-xl active:scale-95 transition-transform whitespace-nowrap"
          >
            Receipts
          </Link>
          <Link
            href="/people"
            className="text-white font-semibold text-sm bg-[#1A1A1A] border border-[#2a2a2a] px-3 py-2 rounded-xl active:scale-95 transition-transform whitespace-nowrap"
          >
            People
          </Link>
          <AccountDropdown email={user.email ?? ""} />
        </div>
      )}
    </nav>
  );
}
