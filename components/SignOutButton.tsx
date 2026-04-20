"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <button
      onClick={handleSignOut}
      className="w-full border border-[#2a2a2a] text-gray-300 font-semibold text-base py-5 rounded-xl active:scale-95 transition-transform"
    >
      Cancel and Sign Out
    </button>
  );
}
