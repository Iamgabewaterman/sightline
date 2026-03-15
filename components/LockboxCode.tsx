"use client";

import { useState } from "react";

export default function LockboxCode({ code }: { code: string }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4">
      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">
        Lockbox Code
      </p>
      <div className="flex items-center justify-between gap-4">
        <p className="text-white text-lg font-mono tracking-widest">
          {visible ? code : "•".repeat(Math.min(code.length, 8))}
        </p>
        <button
          onClick={() => setVisible((v) => !v)}
          className="text-orange-500 font-semibold text-sm px-4 py-3 rounded-xl border border-[#2a2a2a] active:scale-95 transition-transform shrink-0"
        >
          {visible ? "Hide" : "Reveal"}
        </button>
      </div>
    </div>
  );
}
