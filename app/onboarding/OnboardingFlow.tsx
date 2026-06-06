"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { upsertBusinessProfile } from "@/app/actions/business-profile";
import { completeOnboarding } from "@/app/actions/onboarding";

const TRADE_OPTIONS = [
  { value: "roofing",     label: "Roofing" },
  { value: "framing",     label: "Framing" },
  { value: "drywall",     label: "Drywall" },
  { value: "plumbing",    label: "Plumbing" },
  { value: "electrical",  label: "Electrical" },
  { value: "hvac",        label: "HVAC" },
  { value: "paint",       label: "Paint" },
  { value: "tile",        label: "Tile" },
  { value: "flooring",    label: "Flooring" },
  { value: "concrete",    label: "Concrete" },
  { value: "landscaping", label: "Landscaping" },
  { value: "trim",        label: "Trim" },
  { value: "decks_patios", label: "Decks & Patios" },
  { value: "general",    label: "General Contractor" },
];

const inputClass =
  "bg-[#242424] border border-[#333] text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500 w-full";

export default function OnboardingFlow({ inviteCode: _inviteCode }: { inviteCode: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const [ownerName, setOwnerName] = useState("");
  const [bizName, setBizName] = useState("");
  const [primaryTrade, setPrimaryTrade] = useState("");
  const [cityZip, setCityZip] = useState("");

  async function handleSubmit() {
    if (!ownerName.trim()) { setError("Your name is required."); return; }
    if (!bizName.trim()) { setError("Business name is required."); return; }
    setError("");
    setSaving(true);

    await upsertBusinessProfile({
      business_name: bizName.trim(),
      owner_name: ownerName.trim(),
      address: cityZip.trim() || null,
    });

    await completeOnboarding();
    setSaving(false);
    setDone(true);

    // Brief moment to show the success screen, then go to dashboard
    setTimeout(() => router.push("/jobs"), 1400);
  }

  if (done) {
    return (
      <div
        className="fixed inset-0 z-[100] bg-[#0F0F0F] flex flex-col items-center justify-center px-6 text-center"
        onClick={() => router.push("/jobs")}
      >
        <Image src="/icons/brand-logo.png" alt="Sightline" width={240} height={130} className="w-48 h-auto" priority />
        <h1 className="text-white font-black text-3xl mt-8 mb-3 leading-tight">
          You&rsquo;re set up.
        </h1>
        <p className="text-orange-500 font-bold text-xl">Let&rsquo;s build something.</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-[#0F0F0F] overflow-y-auto">
      <div
        className="min-h-screen flex flex-col px-5 py-10 max-w-md mx-auto"
        style={{ paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))" }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-10">
          <div className="w-2 h-2 rounded-full bg-orange-500" />
          <span className="text-white font-bold text-base">Sightline</span>
        </div>

        <h1 className="text-white font-black text-3xl leading-tight mb-2">
          Let&rsquo;s set up your business
        </h1>
        <p className="text-gray-500 text-sm mb-8">
          Takes less than a minute. Everything else can be done in Settings.
        </p>

        <div className="flex flex-col gap-5 flex-1">
          {/* Your Name */}
          <div className="flex flex-col gap-1">
            <label htmlFor="owner-name" className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
              Your Name <span className="text-orange-500">*</span>
            </label>
            <input
              id="owner-name"
              type="text"
              autoCapitalize="words"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="John Smith"
              className={inputClass}
            />
          </div>

          {/* Business Name */}
          <div className="flex flex-col gap-1">
            <label htmlFor="biz-name" className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
              Business Name <span className="text-orange-500">*</span>
            </label>
            <input
              id="biz-name"
              type="text"
              autoCapitalize="words"
              value={bizName}
              onChange={(e) => setBizName(e.target.value)}
              placeholder="Smith Contracting"
              className={inputClass}
            />
          </div>

          {/* Primary Trade */}
          <div className="flex flex-col gap-1">
            <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
              Primary Trade
            </label>
            <div className="flex flex-wrap gap-2">
              {TRADE_OPTIONS.map((t) => {
                const active = primaryTrade === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setPrimaryTrade(active ? "" : t.value)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${
                      active
                        ? "bg-orange-500 border-orange-500 text-white"
                        : "bg-[#1A1A1A] border-[#2a2a2a] text-gray-300"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* City / Zip */}
          <div className="flex flex-col gap-1">
            <label htmlFor="city-zip" className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
              City or Zip Code
            </label>
            <input
              id="city-zip"
              type="text"
              inputMode="text"
              value={cityZip}
              onChange={(e) => setCityZip(e.target.value)}
              placeholder="Portland, OR  or  97201"
              className={inputClass}
            />
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-sm mt-4 bg-red-950/50 border border-red-800/50 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="mt-8 w-full bg-orange-500 text-white font-bold text-lg py-5 rounded-2xl active:scale-95 transition-transform disabled:opacity-60"
        >
          {saving ? "Setting up…" : "Start tracking jobs"}
        </button>
      </div>
    </div>
  );
}
