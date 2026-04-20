"use client";

import { useState, useEffect } from "react";
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

export default function SettingsClient({
  currentEmail,
  profile,
  members,
}: {
  currentEmail: string;
  profile: ProfileWithCompany | null;
  members: CompanyMember[];
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
      </div>
    </div>
  );
}
