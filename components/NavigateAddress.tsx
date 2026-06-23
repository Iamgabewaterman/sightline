"use client";

import { useState } from "react";

/**
 * Renders a job address as a tappable row. Tapping opens a choice sheet to launch
 * turn-by-turn navigation in Apple Maps, Google Maps, or Waze.
 */
export default function NavigateAddress({ address }: { address: string }) {
  const [open, setOpen] = useState(false);
  const enc = encodeURIComponent(address);

  const options = [
    { label: "Apple Maps", href: `maps://maps.apple.com/?address=${enc}`, external: false },
    { label: "Google Maps", href: `https://maps.google.com/?q=${enc}`, external: true },
    { label: "Waze", href: `waze://?q=${enc}`, external: false },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-start gap-2 text-left active:opacity-70 transition-opacity"
      >
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="shrink-0 mt-0.5"
        >
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <span className="text-orange-400 text-base font-semibold underline decoration-orange-500/40 underline-offset-2">
          {address}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setOpen(false)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
          >
            <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mt-3 mb-4" />
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest px-6 mb-1">
              Navigate to
            </p>
            <p className="text-white text-sm px-6 mb-4 truncate">{address}</p>
            <div className="flex flex-col px-4 gap-2 pb-2">
              {options.map((o) => (
                <a
                  key={o.label}
                  href={o.href}
                  {...(o.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4 min-h-[56px] active:scale-95 transition-transform"
                >
                  <span className="text-white font-semibold text-lg">{o.label}</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
