"use client";

import { useState, useEffect } from "react";

function isIOSNotInstalled(): boolean {
  if (typeof window === "undefined") return false;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !(window as Window & { MSStream?: unknown }).MSStream;
  if (!isIOS) return false;
  // On iOS, push only works when installed as PWA
  const isInstalled = (navigator as { standalone?: boolean }).standalone === true;
  return !isInstalled;
}

async function subscribeToPush(): Promise<{ ok: boolean; error?: string }> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, error: "Push notifications are not supported in this browser." };
  }

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    return { ok: false, error: "Push notifications are not configured." };
  }

  // Register SW explicitly first, then wait for it to become active.
  // navigator.serviceWorker.ready hangs forever if no SW is registered —
  // wrap in a timeout so we fail fast instead of loading indefinitely.
  await navigator.serviceWorker.register("/sw.js").catch(() => {
    // Already registered or registration failed — .ready will surface the error
  });

  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Service worker took too long to activate.")), 15000)
    ),
  ]);

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
  });

  const json = subscription.toJSON();
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: body.error ?? "Failed to save push subscription." };
  }

  return { ok: true };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

export default function NotificationPrompt() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pushError, setPushError] = useState("");

  useEffect(() => {
    // Don't show on iOS unless installed as PWA
    if (isIOSNotInstalled()) return;

    // Don't show if permission already decided
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;

    // Don't show if user already dismissed
    if (localStorage.getItem("notif-dismissed")) return;

    // Delay so it doesn't immediately pop on first load
    const t = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    setVisible(false);
    localStorage.setItem("notif-dismissed", "1");
  }

  async function enable() {
    setLoading(true);
    setPushError("");
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        const result = await subscribeToPush();
        if (!result.ok) {
          setPushError(result.error ?? "Could not enable push notifications.");
          return;
        }
      }
      setVisible(false);
      localStorage.setItem("notif-dismissed", "1");
    } catch (err) {
      setPushError(err instanceof Error ? err.message : "Could not enable push notifications.");
    } finally {
      setLoading(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 p-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
      <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-2xl px-5 py-5 shadow-2xl max-w-lg mx-auto">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </div>
            <div>
              <p className="text-white font-bold text-base leading-tight">Stay on top of your jobs</p>
              <p className="text-gray-400 text-sm mt-0.5">Get notified when invoices are paid, crew clocks in, and more.</p>
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
        {pushError && (
          <p className="text-red-400 text-sm mb-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">{pushError}</p>
        )}
        <div className="flex gap-3">
          <button
            onClick={enable}
            disabled={loading}
            className="flex-1 bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-60"
          >
            {loading ? "Enabling…" : "Enable"}
          </button>
          <button
            onClick={dismiss}
            className="px-5 py-4 bg-[#242424] border border-[#333] text-gray-400 font-semibold rounded-xl active:scale-95 transition-transform"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
