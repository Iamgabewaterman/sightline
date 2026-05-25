"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function RefCapture() {
  const searchParams = useSearchParams();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref && /^[A-Z0-9]{8}$/i.test(ref)) {
      document.cookie = `sightline_ref=${ref.toUpperCase()}; max-age=2592000; path=/; SameSite=Lax`;
      setShowBanner(true);
    } else {
      const hasCookie = document.cookie.split(";").some((c) => c.trim().startsWith("sightline_ref="));
      if (hasCookie) setShowBanner(true);
    }
  }, [searchParams]);

  if (!showBanner) return null;

  return (
    <div className="w-full bg-orange-500/10 border-b border-orange-500/20 px-5 py-3 text-center">
      <p className="text-orange-400 text-sm font-semibold">
        You were referred by a Sightline contractor — sign up and they earn a free month.
      </p>
    </div>
  );
}
