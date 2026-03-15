"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { signOut } from "@/app/actions/auth";

interface Props {
  email: string;
}

export default function AccountDropdown({ email }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const linkClass =
    "flex items-center px-4 py-4 text-white text-base font-medium border-b border-[#2a2a2a] active:bg-[#242424] transition-colors";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-white font-semibold text-sm bg-[#1A1A1A] border border-[#2a2a2a] px-4 py-3 rounded-xl active:scale-95 transition-transform flex items-center gap-2"
      >
        <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
        Account
        <span className="text-gray-500 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl overflow-hidden z-50 shadow-2xl">
          {/* Email header */}
          <div className="px-4 py-4 border-b border-[#2a2a2a]">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Signed in as</p>
            <p className="text-white text-sm font-medium truncate">{email}</p>
          </div>

          {/* Menu items */}
          <div className="flex flex-col">
            <Link href="/subscribe" onClick={() => setOpen(false)} className={linkClass}>
              Subscription
            </Link>
            <Link href="/subscribe" onClick={() => setOpen(false)} className={linkClass}>
              Billing
            </Link>
            <Link href="/settings" onClick={() => setOpen(false)} className={linkClass}>
              Settings
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="w-full text-left px-4 py-4 text-red-400 text-base font-medium active:bg-[#242424] transition-colors"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
