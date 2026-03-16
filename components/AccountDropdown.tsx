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
      {/* Icon-only button — fits in compact mobile nav */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        className="w-9 h-9 flex items-center justify-center bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl active:scale-95 transition-transform shrink-0"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4"/>
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
        </svg>
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
