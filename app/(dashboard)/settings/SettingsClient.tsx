"use client";

import { useState, useEffect, useCallback } from "react";
import { updateEmail, updatePassword } from "@/app/actions/auth";
import TeamSection from "./TeamSection";
import { ProfileWithCompany, CompanyMember } from "@/app/actions/team";
import {
  getNotificationPreferences,
  saveNotificationPreferences,
} from "@/app/actions/notification-preferences";
import { NOTIF_TYPES, NotifKey } from "@/app/lib/notification-preferences-config";
import ContactForm from "@/components/ContactForm";
import IdeaBox from "@/components/IdeaBox";
import { ReferralData } from "@/app/actions/referrals";
import { TrialStatus } from "@/app/actions/trial";
import Link from "next/link";

interface SectionProps {
  title: string;
  children: React.ReactNode;
}
function Section({ title, children }: SectionProps) {
  return (
    <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5 flex flex-col gap-4">
      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">{title}</p>
      {children}
    </div>
  );
}

function CollapsibleSection({ title, children }: SectionProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-5 active:opacity-70 transition-opacity"
      >
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">{title}</p>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform duration-200 ${open ? "rotate-180" : "rotate-0"}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-5 flex flex-col gap-4">
          {children}
        </div>
      )}
    </div>
  );
}

const inputClass =
  "bg-[#242424] border border-[#333333] text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500 w-full";

const NOTIF_GROUP_LABELS: Record<string, string> = {
  money: "Money",
  jobsite: "Job Site",
  operational: "Operational",
  client: "Client",
};

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors active:scale-95 ${
        enabled ? "bg-orange-500" : "bg-[#333]"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function ReferralSection({ referralData }: { referralData: ReferralData }) {
  const referralLink = `https://sightline.one/?ref=${referralData.referral_code}`;
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    try {
      navigator.clipboard.writeText(referralLink).catch(() => {
        const el = document.createElement("textarea");
        el.value = referralLink;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      });
    } catch {
      const el = document.createElement("textarea");
      el.value = referralLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [referralLink]);

  function handleShare() {
    const text = `Hey — I've been using Sightline to run my jobs and it's been saving me serious time. First 3 jobs are free, no credit card needed: ${referralLink}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ title: "Try Sightline", text, url: referralLink }).catch(() => {});
    } else {
      handleCopy();
    }
  }

  function fmtDate(iso: string | null) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5 flex flex-col gap-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-orange-500 text-lg">🤝</span>
          <p className="text-white font-bold text-base">Refer a contractor — get a free month</p>
        </div>
        <p className="text-gray-400 text-sm">
          For every contractor you refer who joins and sets up their account, you get one free month added automatically.
        </p>
      </div>

      {/* Referral link */}
      <div className="flex gap-2">
        <div className="flex-1 bg-[#242424] border border-[#333] rounded-xl px-4 py-3 text-gray-300 text-sm font-mono truncate select-all">
          {referralLink}
        </div>
        <button
          onClick={handleCopy}
          className="shrink-0 bg-orange-500 text-white font-bold text-sm px-4 py-3 rounded-xl active:scale-95 transition-transform"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {/* Share button */}
      <button
        onClick={handleShare}
        className="w-full flex items-center justify-center gap-2 bg-[#242424] border border-[#333] text-white font-semibold text-base py-4 rounded-xl active:scale-95 transition-transform"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
        Share with a contractor
      </button>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Referrals sent", value: referralData.total_sent },
          { label: "Completed", value: referralData.completed },
          { label: "Free months", value: referralData.free_months_earned },
        ].map(({ label, value }) => (
          <div key={label} className="bg-[#242424] rounded-xl px-3 py-3 text-center">
            <p className="text-white font-bold text-xl">{value}</p>
            <p className="text-gray-500 text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Referred contractors list */}
      {referralData.referrals.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Your referrals</p>
          {referralData.referrals.map((r, i) => (
            <div key={i} className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-semibold">{r.referred_name ?? "Contractor"}</p>
                {r.referred_joined_at && (
                  <p className="text-gray-500 text-xs">Joined {fmtDate(r.referred_joined_at)}</p>
                )}
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                r.reward_status === "granted"
                  ? "bg-green-900/30 text-green-400"
                  : "bg-orange-500/10 text-orange-400"
              }`}>
                {r.reward_status === "granted" ? "Free month earned" : "Pending"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SettingsClient({
  currentEmail,
  profile,
  members,
  referralData,
  trialStatus,
}: {
  currentEmail: string;
  profile: ProfileWithCompany | null;
  members: CompanyMember[];
  referralData: ReferralData | null;
  trialStatus: TrialStatus | null;
}) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Load theme from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("theme") as "dark" | "light" | null;
    if (saved) setTheme(saved);
  }, []);

  function handleTheme(value: "dark" | "light") {
    setTheme(value);
    localStorage.setItem("theme", value);
    document.documentElement.classList.toggle("light", value === "light");
  }

  // Email form
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function handleEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEmailSaving(true);
    setEmailMsg(null);
    const fd = new FormData(e.currentTarget);
    const result = await updateEmail(fd);
    if (result.error) {
      setEmailMsg({ text: result.error, ok: false });
    } else {
      setEmailMsg({ text: result.message ?? "Done.", ok: true });
      (e.target as HTMLFormElement).reset();
    }
    setEmailSaving(false);
  }

  // Password form
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function handlePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPwSaving(true);
    setPwMsg(null);
    const fd = new FormData(e.currentTarget);
    const result = await updatePassword(fd);
    if (result.error) {
      setPwMsg({ text: result.error, ok: false });
    } else {
      setPwMsg({ text: result.message ?? "Done.", ok: true });
      (e.target as HTMLFormElement).reset();
    }
    setPwSaving(false);
  }

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState<Record<NotifKey, boolean> | null>(null);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifToast, setNotifToast] = useState(false);
  const [notifLoadError, setNotifLoadError] = useState(false);

  useEffect(() => {
    getNotificationPreferences()
      .then(setNotifPrefs)
      .catch(() => setNotifLoadError(true));
  }, []);

  async function handleNotifToggle(key: NotifKey) {
    if (!notifPrefs) return;
    const updated = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(updated);
    setNotifSaving(true);
    await saveNotificationPreferences(updated);
    setNotifSaving(false);
    setNotifToast(true);
    setTimeout(() => setNotifToast(false), 1500);
  }

  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-8 pb-16">
      <div className="max-w-lg mx-auto flex flex-col gap-6">
        <h1 className="text-3xl font-bold text-white">Settings</h1>

        {/* Trial status card — shown for non-paying, non-lifetime users */}
        {trialStatus && !trialStatus.isLifetime && !trialStatus.isPaying && (
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5 flex flex-col gap-4">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
              {trialStatus.isExpired ? "Trial Ended" : "Your Trial"}
            </p>

            {trialStatus.isExpired ? (
              <p className="text-gray-300 text-sm">
                Your trial has ended. Subscribe to keep all your data and continue using Sightline.
              </p>
            ) : (
              <>
                {/* Progress bar */}
                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <p className="text-white font-semibold text-sm">
                      {trialStatus.jobsCompleted} of {trialStatus.jobsLimit} qualifying jobs completed
                    </p>
                    <p className="text-gray-500 text-xs">{trialStatus.daysLeft}d left</p>
                  </div>
                  <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 rounded-full transition-all"
                      style={{ width: `${(trialStatus.jobsCompleted / trialStatus.jobsLimit) * 100}%` }}
                    />
                  </div>
                  {trialStatus.jobsCompleted === trialStatus.jobsLimit - 1 && (
                    <p className="text-orange-400 text-xs mt-2 font-semibold">
                      One more qualifying job and you&apos;ll be asked to subscribe.
                    </p>
                  )}
                </div>
                <p className="text-gray-500 text-xs leading-relaxed">
                  A qualifying job must have materials or labor logged and must have been active for at least 3 days.
                  Your trial expires when you complete 3 qualifying jobs or after {trialStatus.daysLeft} days — whichever comes first.
                </p>
              </>
            )}

            <Link
              href="/subscribe"
              className="block w-full bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform text-center"
            >
              Start Subscription — $49.99/month
            </Link>
          </div>
        )}

        {/* Team */}
        {profile && <TeamSection profile={profile} members={members} />}

        {/* Notifications */}
        <CollapsibleSection title="Notifications">
          {notifSaving && <p className="text-gray-500 text-xs -mt-2">Saving…</p>}
          {notifToast && <p className="text-green-400 text-xs -mt-2">Saved</p>}
          {notifPrefs ? (
            <div className="flex flex-col gap-5">
              {(Object.keys(NOTIF_TYPES) as (keyof typeof NOTIF_TYPES)[]).map((group) => (
                <div key={group}>
                  <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
                    {NOTIF_GROUP_LABELS[group]}
                  </p>
                  <div className="flex flex-col gap-1">
                    {NOTIF_TYPES[group].map(({ key, label }) => (
                      <div
                        key={key}
                        className="flex items-center justify-between py-3 border-b border-[#222] last:border-0"
                      >
                        <span className="text-white text-sm">{label}</span>
                        <Toggle
                          enabled={notifPrefs[key as NotifKey] ?? true}
                          onToggle={() => handleNotifToggle(key as NotifKey)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : notifLoadError ? (
            <p className="text-red-400 text-sm">Failed to load preferences. Please refresh.</p>
          ) : (
            <p className="text-gray-600 text-sm">Loading…</p>
          )}
        </CollapsibleSection>

        {/* Account & Security (Email + Password combined) */}
        <CollapsibleSection title="Account &amp; Security">
          {/* Change Email */}
          <div className="flex flex-col gap-3">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Change Email</p>
            <p className="text-gray-500 text-sm -mt-1">
              Current: <span className="text-white">{currentEmail}</span>
            </p>
            <form onSubmit={handleEmail} className="flex flex-col gap-3">
              <input
                name="email"
                type="email"
                required
                placeholder="New email address"
                autoComplete="email"
                className={inputClass}
              />
              {emailMsg && (
                <p
                  className={`text-sm rounded-xl px-4 py-3 border ${
                    emailMsg.ok
                      ? "text-green-400 bg-green-950 border-green-800"
                      : "text-red-400 bg-red-950 border-red-800"
                  }`}
                >
                  {emailMsg.text}
                </p>
              )}
              <button
                type="submit"
                disabled={emailSaving}
                className="bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
              >
                {emailSaving ? "Saving..." : "Update Email"}
              </button>
            </form>
          </div>

          <div className="border-t border-[#2a2a2a]" />

          {/* Change Password */}
          <div className="flex flex-col gap-3">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Change Password</p>
            <form onSubmit={handlePassword} className="flex flex-col gap-3">
              <input
                name="password"
                type="password"
                required
                placeholder="New password (min 8 characters)"
                autoComplete="new-password"
                className={inputClass}
              />
              <input
                name="confirm"
                type="password"
                required
                placeholder="Confirm new password"
                autoComplete="new-password"
                className={inputClass}
              />
              {pwMsg && (
                <p
                  className={`text-sm rounded-xl px-4 py-3 border ${
                    pwMsg.ok
                      ? "text-green-400 bg-green-950 border-green-800"
                      : "text-red-400 bg-red-950 border-red-800"
                  }`}
                >
                  {pwMsg.text}
                </p>
              )}
              <button
                type="submit"
                disabled={pwSaving}
                className="bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
              >
                {pwSaving ? "Saving..." : "Update Password"}
              </button>
            </form>
            <a
              href="/login"
              className="text-orange-500 text-sm font-medium text-center -mt-1"
            >
              Forgot your password? Reset via email →
            </a>
          </div>
        </CollapsibleSection>

        {/* Refer a Contractor */}
        {referralData && referralData.referral_code && (
          <ReferralSection referralData={referralData} />
        )}

        {/* Contact & Support */}
        <Section title="Contact &amp; Support">
          <p className="text-gray-500 text-sm -mt-1">
            Questions, feedback, or need help? We reply same day.
          </p>
          <ContactForm variant="settings" />
        </Section>

        {/* Share an idea */}
        <Section title="Share an idea">
          <IdeaBox variant="settings" />
        </Section>

        {/* Theme */}
        <Section title="Appearance">
          <div className="flex gap-2">
            {(["dark", "light"] as const).map((t) => (
              <button
                key={t}
                onClick={() => handleTheme(t)}
                className={`flex-1 py-4 rounded-xl font-semibold text-sm border transition-colors active:scale-95 ${
                  theme === t
                    ? "bg-orange-500 text-white border-orange-500"
                    : "bg-[#242424] text-gray-400 border-[#2a2a2a]"
                }`}
              >
                {t === "dark" ? "Dark" : "Light"}
              </button>
            ))}
          </div>
        </Section>

        {/* Legal */}
        <div className="flex items-center justify-center gap-6 pt-2">
          <a href="/privacy" className="text-gray-600 text-xs hover:text-gray-400 transition-colors">Privacy Policy</a>
          <span className="text-gray-700 text-xs">·</span>
          <a href="/terms" className="text-gray-600 text-xs hover:text-gray-400 transition-colors">Terms of Service</a>
        </div>
      </div>
    </div>
  );
}
