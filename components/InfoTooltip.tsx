"use client";

import { useState } from "react";

export default function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        aria-label="More info"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="text-gray-500 hover:text-gray-300 transition-colors leading-none"
        style={{ fontSize: 11, lineHeight: 1 }}
      >
        ⓘ
      </button>
      {open && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-[#2a2a2a] border border-[#3a3a3a] text-gray-300 text-xs rounded-xl px-3 py-2.5 shadow-xl z-50 pointer-events-none"
          style={{ lineHeight: 1.4 }}
        >
          {text}
          {/* small caret */}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#3a3a3a]" />
        </span>
      )}
    </span>
  );
}
