"use client";

import { useState } from "react";
import Link from "next/link";

export default function DemoWriteGuard({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="relative">
        <div className="pointer-events-none opacity-70">{children}</div>
        <div
          className="absolute inset-0 cursor-pointer"
          onClick={() => setOpen(true)}
          aria-label="Sign up to edit"
        />
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-t-2xl w-full max-w-lg px-6 py-7"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.75rem)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mb-5" />
            <p className="text-white font-bold text-xl mb-1">Start your free trial</p>
            <p className="text-gray-400 text-sm mb-6">
              Create an account to add jobs, log materials and labor, generate quotes, and get paid — all in one place.
            </p>
            <Link
              href="/signup"
              className="block w-full bg-orange-500 text-white font-bold text-lg py-4 rounded-xl text-center active:scale-95 transition-transform"
            >
              Create Free Account
            </Link>
            <button
              onClick={() => setOpen(false)}
              className="block w-full text-gray-500 text-base font-semibold py-3 text-center mt-2 active:text-gray-300"
            >
              Continue browsing demo
            </button>
          </div>
        </div>
      )}
    </>
  );
}
