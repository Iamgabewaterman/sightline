"use client";

import { useState, useEffect } from "react";

// ─── Service Worker Registration ─────────────────────────────────────────────

function useServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failed — app still works, just no offline caching
    });
  }, []);
}

// ─── Install Prompt ───────────────────────────────────────────────────────────

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function InstallBanner() {
  const [nativePrompt, setNativePrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Don't show if already running as installed PWA
    const isInstalled =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as { standalone?: boolean }).standalone === true;
    if (isInstalled) return;

    // Don't show if already dismissed
    if (localStorage.getItem("pwa-dismissed")) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream;
    setIsIOS(ios);

    if (ios) {
      // iOS has no beforeinstallprompt — show hint after a short delay
      const t = setTimeout(() => setVisible(true), 4000);
      return () => clearTimeout(t);
    }

    // Android / Chrome — wait for the browser's own prompt event
    const handler = (e: Event) => {
      e.preventDefault();
      setNativePrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    setVisible(false);
    localStorage.setItem("pwa-dismissed", "1");
  }

  async function install() {
    if (nativePrompt) {
      await nativePrompt.prompt();
      const { outcome } = await nativePrompt.userChoice;
      if (outcome === "accepted") {
        setVisible(false);
        return;
      }
    }
    dismiss();
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
      <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-2xl px-5 py-5 shadow-2xl max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            {/* Mini app icon */}
            <div className="w-12 h-12 bg-[#0F0F0F] rounded-xl flex items-center justify-center shrink-0">
              <svg viewBox="0 0 48 48" width="32" height="32">
                <circle cx="24" cy="24" r="16" fill="#f97316" />
                <circle cx="24" cy="24" r="9"  fill="#0F0F0F" />
                <circle cx="24" cy="24" r="5"  fill="#f97316" />
              </svg>
            </div>
            <div>
              <p className="text-white font-bold text-base leading-tight">Add Sightline to your home screen</p>
              <p className="text-gray-400 text-sm mt-0.5">Works like a native app, loads instantly</p>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="text-gray-500 text-2xl leading-none shrink-0 active:scale-95 transition-transform mt-0.5"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>

        {/* iOS instructions */}
        {isIOS && (
          <p className="text-gray-400 text-sm mb-4 bg-[#242424] rounded-xl px-4 py-3">
            Tap the <span className="text-white font-semibold">Share</span> button{" "}
            <span className="text-gray-400">⎙</span> in Safari, then choose{" "}
            <span className="text-white font-semibold">Add to Home Screen</span>.
          </p>
        )}

        {/* CTA */}
        {!isIOS ? (
          <button
            onClick={install}
            className="w-full bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform"
          >
            Add to Home Screen
          </button>
        ) : (
          <button
            onClick={dismiss}
            className="w-full bg-[#242424] border border-[#333] text-gray-300 font-semibold text-base py-4 rounded-xl active:scale-95 transition-transform"
          >
            Got it
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Combined export ──────────────────────────────────────────────────────────

export default function PwaSetup() {
  useServiceWorker();
  return <InstallBanner />;
}
