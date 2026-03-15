"use client";

import { signOut } from "@/app/actions/auth";

export default function LogoutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="text-gray-400 font-semibold text-sm px-4 py-3 rounded-xl border border-gray-700 active:scale-95 transition-transform"
      >
        Sign Out
      </button>
    </form>
  );
}
