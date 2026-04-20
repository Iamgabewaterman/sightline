"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useClockContext } from "./ClockContext";
import { createClient } from "@/lib/supabase/client";
import Avatar from "./Avatar";

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke={active ? "#F97316" : "#9CA3AF"} strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12L12 4l9 8" />
      <path d="M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9" />
    </svg>
  );
}

function BriefcaseIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke={active ? "#F97316" : "#9CA3AF"} strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
      <line x1="12" y1="12" x2="12" y2="16" />
      <line x1="10" y1="14" x2="14" y2="14" />
    </svg>
  );
}

function GridIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke={active ? "#F97316" : "#9CA3AF"} strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function PersonIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke={active ? "#F97316" : "#9CA3AF"} strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

const MORE_ITEMS = [
  { label: "Mileage Tracker",  href: "/mileage" },
  { label: "People & Crews",   href: "/people" },
  { label: "Calendar",         href: "/calendar" },
  { label: "Clients",          href: "/clients" },
  { label: "Profitability",    href: "/profit" },
  { label: "Receipts",         href: "/receipts" },
  { label: "Templates",        href: "/templates" },
  { label: "Portfolio",        href: "/portfolio" },
  { label: "Tax Report",       href: "/tax" },
  { label: "QuickBooks Import",href: "/import" },
];

export default function BottomTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [quickOpen, setQuickOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { openClockIn, activeSession } = useClockContext();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("Me");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      Promise.all([
        supabase.from("profiles").select("display_name, avatar_path").eq("id", user.id).maybeSingle(),
        supabase.from("business_profiles").select("owner_name").eq("user_id", user.id).maybeSingle(),
      ]).then(([{ data: profile }, { data: bp }]) => {
        const name =
          profile?.display_name ||
          bp?.owner_name ||
          user.email?.split("@")[0] ||
          "Me";
        setDisplayName(name);
        if (profile?.avatar_path) {
          setAvatarUrl(
            supabase.storage.from("avatars").getPublicUrl(profile.avatar_path).data.publicUrl +
            "?t=" + Date.now()
          );
        }
      });
    });
  }, []);

  const isHome    = pathname === "/jobs" || (pathname.startsWith("/jobs") && !pathname.startsWith("/jobs/all") && !pathname.startsWith("/jobs/new"));
  const isJobs    = pathname.startsWith("/jobs/all");
  const isAccount = pathname.startsWith("/account");
  const isMore    = MORE_ITEMS.some((i) => pathname.startsWith(i.href));

  const tabClass = "flex-1 flex flex-col items-center justify-center gap-1 min-h-[48px] active:opacity-70 transition-opacity";
  const labelClass = (active: boolean) =>
    `text-[10px] font-semibold leading-none ${active ? "text-orange-500" : "text-gray-400"}`;

  function closeAll() {
    setQuickOpen(false);
    setMoreOpen(false);
  }

  return (
    <>
      {/* ── BOTTOM TAB BAR ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 bg-[#141414] border-t border-[#232323]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-end h-14 overflow-visible">

          {/* Home */}
          <Link href="/jobs" className={tabClass} onClick={closeAll}>
            <HomeIcon active={isHome} />
            <span className={labelClass(isHome)}>Home</span>
          </Link>

          {/* Jobs */}
          <Link href="/jobs/all" className={tabClass} onClick={closeAll}>
            <BriefcaseIcon active={isJobs} />
            <span className={labelClass(isJobs)}>Jobs</span>
          </Link>

          {/* Center + */}
          <div className="flex-1 flex justify-center items-end pb-2 overflow-visible">
            <button
              onClick={() => { setMoreOpen(false); setQuickOpen((o) => !o); }}
              aria-label="Quick actions"
              className="w-14 h-14 rounded-full bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30 active:scale-95 transition-transform mb-1"
              style={{ marginBottom: "10px" }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>

          {/* More */}
          <button
            className={tabClass}
            onClick={() => { setQuickOpen(false); setMoreOpen((o) => !o); }}
            aria-label="More"
          >
            <GridIcon active={isMore || moreOpen} />
            <span className={labelClass(isMore || moreOpen)}>More</span>
          </button>

          {/* Account */}
          <Link href="/account" className={tabClass} onClick={closeAll}>
            {avatarUrl ? (
              <div className={`rounded-full overflow-hidden ${isAccount ? "ring-2 ring-orange-500" : ""}`}>
                <Avatar name={displayName} avatarUrl={avatarUrl} size={24} />
              </div>
            ) : (
              <PersonIcon active={isAccount} />
            )}
            <span className={labelClass(isAccount)}>Account</span>
          </Link>

        </div>
      </div>

      {/* ── QUICK ACTION SHEET ── */}
      {quickOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setQuickOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}>
            <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mt-3 mb-5" />
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest px-6 mb-3">Quick Actions</p>
            <div className="flex flex-col px-4 gap-3 pb-2">
              <Link
                href="/jobs/new"
                onClick={() => setQuickOpen(false)}
                className="flex items-center gap-4 bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4 active:scale-95 transition-transform"
              >
                <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" />
                    <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
                    <line x1="12" y1="11" x2="12" y2="17" />
                    <line x1="9" y1="14" x2="15" y2="14" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-semibold text-base">New Job</p>
                  <p className="text-gray-500 text-sm">Start a new job</p>
                </div>
              </Link>

              <button
                onClick={() => { setQuickOpen(false); openClockIn(); }}
                className="flex items-center gap-4 bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4 active:scale-95 transition-transform w-full text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-semibold text-base">{activeSession ? "Change Job" : "Clock In"}</p>
                  <p className="text-gray-500 text-sm">{activeSession ? "Switch active session" : "Log time to a job"}</p>
                </div>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── MORE SHEET ── */}
      {moreOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setMoreOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414] border-t border-[#2a2a2a] rounded-t-2xl"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}>
            <div className="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mt-3 mb-5" />
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest px-6 mb-3">More</p>
            <div className="flex flex-col px-4 gap-1 overflow-y-auto max-h-[60vh] pb-2">
              {MORE_ITEMS.map(({ label, href }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center justify-between bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4 active:scale-95 transition-transform"
                >
                  <span className="text-white font-semibold text-base">{label}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
