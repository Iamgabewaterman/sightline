"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { grantLifetimeAccess, sendTestPush } from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HQUser {
  id: string;
  email: string;
  name: string;
  businessName: string;
  location: string;
  joinedAt: string;
  status: "lifetime" | "paying" | "trial" | "expired";
  trialDaysLeft: number | null;
  lastActiveAt: string | null;
}

export interface FeatureRow {
  name: string;
  userCount: number;
  pct: number;
}

export interface WeeklyBucket {
  label: string;
  count: number;
}

export interface ReferralStats {
  total_links: number;
  total_completed: number;
  total_pending: number;
  top_referrers: { name: string; email: string; count: number }[];
  log: { referrer_name: string; referred_name: string; created_at: string; granted_at: string | null; reward_status: string }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return fmtDate(iso);
}

function StatusBadge({ status, daysLeft }: { status: HQUser["status"]; daysLeft: number | null }) {
  if (status === "lifetime")
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-400">
        Lifetime
      </span>
    );
  if (status === "paying")
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-500/20 text-green-400">
        Paying
      </span>
    );
  if (status === "trial")
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-500/20 text-orange-400">
        Trial · {daysLeft ?? 0}d left
      </span>
    );
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-400">
      Expired
    </span>
  );
}

function exportCSV(users: HQUser[]) {
  const headers = ["Email", "Name", "Business", "Joined", "Status", "Location"];
  const rows = users.map((u) => [
    u.email,
    u.name,
    u.businessName,
    fmtDate(u.joinedAt),
    u.status,
    u.location,
  ]);
  const csv = [headers, ...rows]
    .map((r) => r.map((c) => `"${(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sightline-users-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  userId: string;
  totalAccounts: number;
  paying: number;
  activeTrials: number;
  churned: number;
  users: HQUser[];
  weeklySignups: WeeklyBucket[];
  features: FeatureRow[];
  referralStats: ReferralStats;
}

type FilterTab = "all" | "trial" | "paying" | "expired";

export default function HQDashboard({
  userId,
  totalAccounts,
  paying,
  activeTrials,
  churned,
  users,
  weeklySignups,
  features,
  referralStats,
}: Props) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // ── User table state ───────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");

  const filtered = useMemo(() => {
    let list = users;
    if (filter !== "all") {
      list = list.filter((u) =>
        filter === "paying"
          ? u.status === "paying" || u.status === "lifetime"
          : u.status === filter
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          u.name.toLowerCase().includes(q) ||
          u.businessName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [users, filter, search]);

  // ── Quick action state ─────────────────────────────────────────────────────
  const [grantEmail, setGrantEmail] = useState("");
  const [grantStatus, setGrantStatus] = useState<string>("");
  const [grantLoading, setGrantLoading] = useState(false);
  const [pushStatus, setPushStatus] = useState<string>("");
  const [pushLoading, setPushLoading] = useState(false);

  async function handleGrant() {
    if (!grantEmail.trim()) return;
    setGrantLoading(true);
    setGrantStatus("");
    const result = await grantLifetimeAccess(grantEmail);
    setGrantLoading(false);
    if (result.error) {
      setGrantStatus(`Error: ${result.error}`);
    } else {
      setGrantStatus(`Lifetime access granted to ${grantEmail}`);
      setGrantEmail("");
    }
  }

  async function handleTestPush() {
    setPushLoading(true);
    setPushStatus("");
    const result = await sendTestPush(userId);
    setPushLoading(false);
    setPushStatus(result.error ? `Error: ${result.error}` : "Test push sent!");
  }

  // ── Chart helpers ──────────────────────────────────────────────────────────
  const maxWeekly = Math.max(...weeklySignups.map((w) => w.count), 1);
  const maxFeaturePct = Math.max(...features.map((f) => f.pct), 1);

  const recentSignups = users.slice(0, 10);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0F0F0F] text-white px-4 py-8 pb-16">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link
                href="/jobs"
                className="text-gray-400 text-2xl leading-none active:scale-95 transition-transform min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Back to app"
              >
                ←
              </Link>
              <h1 className="text-3xl font-black text-white">
                Sightline{" "}
                <span className="text-orange-500">HQ</span>
              </h1>
            </div>
            <p className="text-gray-500 text-sm ml-14">{dateStr}</p>
          </div>
          <div className="text-right">
            <p className="text-gray-600 text-xs">Last updated</p>
            <p className="text-gray-400 text-xs font-semibold">
              {now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </p>
          </div>
        </div>

        {/* ── Section 1: Stat cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total Accounts", value: totalAccounts, color: "text-white" },
            { label: "Active Trials", value: activeTrials, color: "text-orange-400" },
            { label: "Paying", value: paying, color: "text-green-400" },
            { label: "Churned", value: churned, color: "text-red-400" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4"
            >
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">
                {label}
              </p>
              <p className={`text-3xl font-black ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Weekly signups chart */}
        <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5 mb-8">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-4">
            Signups — Last 12 Weeks
          </p>
          <div className="flex items-end gap-1.5 h-24">
            {weeklySignups.map((w, i) => (
              <div key={i} className="flex flex-col items-center gap-1 flex-1">
                {w.count > 0 && (
                  <span className="text-gray-500 text-xs leading-none">{w.count}</span>
                )}
                <div
                  className="w-full bg-orange-500 rounded-t transition-all"
                  style={{
                    height: `${Math.max((w.count / maxWeekly) * 72, w.count > 0 ? 4 : 0)}px`,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-1.5 mt-1">
            {weeklySignups.map((w, i) => (
              <div key={i} className="flex-1 text-center">
                <span
                  className="text-gray-700 block"
                  style={{ fontSize: 8, lineHeight: "1.2" }}
                >
                  {w.label.split(" ")[1]}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-1.5 mt-0">
            {weeklySignups.map((w, i) => (
              <div key={i} className="flex-1 text-center">
                <span
                  className="text-gray-700 block"
                  style={{ fontSize: 7, lineHeight: "1.2" }}
                >
                  {w.label.split(" ")[0]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Section 2: User table ── */}
        <div className="mb-8">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">
            All Users ({totalAccounts})
          </p>

          {/* Search + filter */}
          <div className="flex flex-col sm:flex-row gap-3 mb-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email or name…"
              className="flex-1 bg-[#1A1A1A] border border-[#2a2a2a] text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
            />
            <div className="flex gap-2">
              {(["all", "trial", "paying", "expired"] as FilterTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors capitalize ${
                    filter === tab
                      ? "bg-orange-500 text-white"
                      : "bg-[#1A1A1A] border border-[#2a2a2a] text-gray-400 hover:text-white"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2a2a2a]">
                    {["Email", "Name", "Joined", "Status", "Last Active", "Location"].map(
                      (h) => (
                        <th
                          key={h}
                          className="text-left text-gray-500 text-xs font-semibold uppercase tracking-wider px-4 py-3"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center text-gray-600 py-8 px-4"
                      >
                        No users match.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((u) => (
                      <tr
                        key={u.id}
                        className="border-b border-[#1f1f1f] hover:bg-[#1f1f1f] transition-colors"
                      >
                        <td className="px-4 py-3 text-gray-300 font-mono text-xs">
                          {u.email}
                        </td>
                        <td className="px-4 py-3 text-white font-semibold text-xs">
                          {u.name || <span className="text-gray-600">—</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                          {fmtDate(u.joinedAt)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <StatusBadge status={u.status} daysLeft={u.trialDaysLeft} />
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                          {fmtRelative(u.lastActiveAt)}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {u.location || "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Section 3: Feature usage ── */}
        <div className="mb-8">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">
            Feature Adoption — {totalAccounts} total users
          </p>
          <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  {["Feature", "Users", "%", "Adoption"].map((h) => (
                    <th
                      key={h}
                      className="text-left text-gray-500 text-xs font-semibold uppercase tracking-wider px-4 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {features.map((f) => (
                  <tr
                    key={f.name}
                    className="border-b border-[#1f1f1f] hover:bg-[#1f1f1f] transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-300 text-sm">{f.name}</td>
                    <td className="px-4 py-3 text-white font-semibold text-sm">
                      {f.userCount}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{f.pct}%</td>
                    <td className="px-4 py-3 w-40">
                      <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            f.pct >= 50
                              ? "bg-green-500"
                              : f.pct >= 20
                              ? "bg-orange-500"
                              : "bg-[#3a3a3a]"
                          }`}
                          style={{
                            width: `${maxFeaturePct > 0 ? (f.pct / maxFeaturePct) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Section 4: Recent signups ── */}
        <div className="mb-8">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">
            Recent Signups
          </p>
          <div className="flex flex-col gap-2">
            {recentSignups.length === 0 ? (
              <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4 text-gray-600 text-sm">
                No signups yet.
              </div>
            ) : (
              recentSignups.map((u) => (
                <div
                  key={u.id}
                  className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-sm truncate">
                      {u.email}
                    </p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {u.businessName ? `${u.businessName} · ` : ""}
                      Joined {fmtRelative(u.joinedAt)}
                    </p>
                  </div>
                  <StatusBadge status={u.status} daysLeft={u.trialDaysLeft} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Section 5: Quick actions ── */}
        <div className="mb-8">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">
            Quick Actions
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            {/* Grant Lifetime Access */}
            <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5">
              <p className="text-white font-semibold text-sm mb-3">
                Grant Lifetime Access
              </p>
              <input
                type="email"
                value={grantEmail}
                onChange={(e) => setGrantEmail(e.target.value)}
                placeholder="user@email.com"
                className="w-full bg-[#111] border border-[#333] text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors mb-3"
              />
              <button
                onClick={handleGrant}
                disabled={grantLoading || !grantEmail.trim()}
                className="w-full bg-orange-500 text-white font-bold text-sm py-3 rounded-xl hover:bg-orange-400 transition-colors active:scale-95 disabled:opacity-40"
              >
                {grantLoading ? "Granting…" : "Grant Lifetime"}
              </button>
              {grantStatus && (
                <p
                  className={`text-xs mt-2 ${
                    grantStatus.startsWith("Error") ? "text-red-400" : "text-green-400"
                  }`}
                >
                  {grantStatus}
                </p>
              )}
            </div>

            {/* Export User List */}
            <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5 flex flex-col">
              <p className="text-white font-semibold text-sm mb-1">
                Export User List
              </p>
              <p className="text-gray-500 text-xs mb-4 flex-1">
                Download a CSV of all {totalAccounts} users with email, name, join
                date, and subscription status.
              </p>
              <button
                onClick={() => exportCSV(users)}
                className="w-full bg-[#2a2a2a] text-white font-semibold text-sm py-3 rounded-xl hover:bg-[#333] transition-colors active:scale-95"
              >
                Download CSV
              </button>
            </div>

            {/* Send Test Push */}
            <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5 flex flex-col">
              <p className="text-white font-semibold text-sm mb-1">
                Send Test Push
              </p>
              <p className="text-gray-500 text-xs mb-4 flex-1">
                Send a test push notification to your own account to verify
                notifications are working.
              </p>
              <button
                onClick={handleTestPush}
                disabled={pushLoading}
                className="w-full bg-[#2a2a2a] text-white font-semibold text-sm py-3 rounded-xl hover:bg-[#333] transition-colors active:scale-95 disabled:opacity-40"
              >
                {pushLoading ? "Sending…" : "Send Test Push"}
              </button>
              {pushStatus && (
                <p
                  className={`text-xs mt-2 ${
                    pushStatus.startsWith("Error") ? "text-red-400" : "text-green-400"
                  }`}
                >
                  {pushStatus}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Referrals ─────────────────────────────────────────────────────── */}
        <div className="mt-8">
          <h2 className="text-white font-bold text-xl mb-4">Referrals</h2>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: "Unique referrers", value: referralStats.total_links },
              { label: "Rewards granted", value: referralStats.total_completed },
              { label: "Pending rewards", value: referralStats.total_pending },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 text-center">
                <p className="text-white font-bold text-2xl">{value}</p>
                <p className="text-gray-500 text-xs mt-1">{label}</p>
              </div>
            ))}
          </div>

          {referralStats.top_referrers.length > 0 && (
            <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-5 mb-4">
              <p className="text-white font-semibold text-sm mb-3">Top Referrers</p>
              <div className="flex flex-col gap-2">
                {referralStats.top_referrers.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">{r.name || r.email}</span>
                    <span className="text-orange-500 font-bold">{r.count} referral{r.count !== 1 ? "s" : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {referralStats.log.length > 0 && (
            <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl overflow-hidden">
              <p className="text-white font-semibold text-sm px-5 py-4 border-b border-[#2a2a2a]">Referral Log</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#2a2a2a]">
                      {["Referrer", "Referred", "Joined", "Granted", "Status"].map((h) => (
                        <th key={h} className="text-left text-gray-500 text-xs font-semibold px-5 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {referralStats.log.map((r, i) => (
                      <tr key={i} className="border-b border-[#2a2a2a] last:border-0">
                        <td className="px-5 py-3 text-gray-300">{r.referrer_name}</td>
                        <td className="px-5 py-3 text-gray-300">{r.referred_name}</td>
                        <td className="px-5 py-3 text-gray-500">{fmtDate(r.created_at)}</td>
                        <td className="px-5 py-3 text-gray-500">{r.granted_at ? fmtDate(r.granted_at) : "—"}</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                            r.reward_status === "granted"
                              ? "bg-green-900/30 text-green-400"
                              : "bg-orange-500/10 text-orange-400"
                          }`}>
                            {r.reward_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
