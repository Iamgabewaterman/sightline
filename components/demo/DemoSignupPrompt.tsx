"use client";

import { useState } from "react";
import Link from "next/link";

interface Props {
  children: React.ReactNode;
  label?: string;
}

export default function DemoSignupPrompt({ children, label }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="relative">
        <div onClick={() => setOpen(true)} className="cursor-pointer">
          {children}
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-end justify-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-[#141414] border border-[#2a2a2a] rounded-t-2xl w-full max-w-lg px-6 py-7"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.75rem)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mb-5" />
            <p className="text-orange-400 text-xs font-bold uppercase tracking-widest mb-2">Ready to use this?</p>
            <p className="text-white font-bold text-xl mb-2">
              {label ?? "Track your own jobs"}
            </p>
            <p className="text-gray-400 text-sm mb-6">
              Start your free trial — first 3 jobs free, no credit card required.
            </p>
            <Link
              href="/signup"
              className="block w-full bg-orange-500 text-white font-bold text-lg py-4 rounded-xl text-center active:scale-95 transition-transform"
            >
              Start Free Trial →
            </Link>
            <button
              onClick={() => setOpen(false)}
              className="block w-full text-gray-500 text-base font-semibold py-3 text-center mt-1 active:text-gray-300"
            >
              Continue Exploring
            </button>
          </div>
        </div>
      )}
    </>
  );
}
