"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Detects PWA standalone mode (iOS navigator.standalone or
 * Android display-mode: standalone) and redirects immediately.
 * Renders nothing — purely a side-effect component.
 */
export default function StandaloneRedirect({ to }: { to: string }) {
  const router = useRouter();

  useEffect(() => {
    const isStandalone =
      (navigator as { standalone?: boolean }).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;

    if (isStandalone) {
      router.replace(to);
    }
  }, [to, router]);

  return null;
}
