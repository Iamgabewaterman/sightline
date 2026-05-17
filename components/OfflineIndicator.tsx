"use client";

import { useEffect, useState } from "react";

export default function OfflineIndicator() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const on  = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online",  on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online",  on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-[#1a1a1a] border-b border-yellow-500/30 px-4 py-2 flex items-center justify-center gap-2">
      <span className="w-2 h-2 rounded-full bg-yellow-500 shrink-0" />
      <p className="text-yellow-400 text-xs font-semibold">No connection — working offline</p>
    </div>
  );
}
