"use client";

import { useState } from "react";
import { enablePortal, disablePortal } from "@/app/actions/portal";

interface Props {
  jobId: string;
  initialEnabled: boolean;
  initialToken: string | null;
}

export default function PortalToggle({ jobId, initialEnabled, initialToken }: Props) {
  const [enabled, setEnabled]  = useState(initialEnabled);
  const [token, setToken]      = useState<string | null>(initialToken);
  const [saving, setSaving]    = useState(false);
  const [copied, setCopied]    = useState(false);

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://sightline.one";

  const portalUrl = token ? `${origin}/portal/${jobId}/${token}` : null;

  async function handleToggle() {
    setSaving(true);
    if (enabled) {
      await disablePortal(jobId);
      setEnabled(false);
    } else {
      const res = await enablePortal(jobId);
      if (res.token) {
        setToken(res.token);
        setEnabled(true);
      }
    }
    setSaving(false);
  }

  async function handleShare() {
    if (!portalUrl) return;
    if (navigator.share) {
      await navigator.share({ title: "Project Portal", url: portalUrl });
    } else {
      await navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  return (
    <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white font-semibold text-base">Client Portal</p>
          <p className="text-gray-500 text-xs mt-0.5">
            {enabled ? "Active — client can view job progress" : "Disabled — link is inactive"}
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={saving}
          className={`relative w-12 h-6 rounded-full transition-colors duration-200 shrink-0 disabled:opacity-60 ${
            enabled ? "bg-orange-500" : "bg-[#333]"
          }`}
          aria-label={enabled ? "Disable portal" : "Enable portal"}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
              enabled ? "translate-x-6" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {enabled && portalUrl && (
        <button
          onClick={handleShare}
          className="mt-4 w-full flex items-center justify-center gap-2 bg-orange-500/10 border border-orange-500/30 text-orange-400 font-semibold text-sm py-3.5 rounded-xl active:scale-95 transition-transform"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          {copied ? "Link Copied!" : "Share Portal Link"}
        </button>
      )}
    </div>
  );
}
