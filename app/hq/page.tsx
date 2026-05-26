import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import HQDashboard, {
  type HQUser,
  type FeatureRow,
  type WeeklyBucket,
  type ReferralStats,
  type TrialMetrics,
  type SignupRow,
} from "./HQDashboard";

const ADMIN_EMAIL = "gabew595@gmail.com";

function extractCityState(address: string | null): string {
  if (!address) return "";
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length >= 3) {
    const city = parts[parts.length - 2];
    const stateZip = parts[parts.length - 1].trim().split(" ");
    return `${city}, ${stateZip[0] ?? ""}`.trim().replace(/,$/, "");
  }
  return address.slice(0, 25);
}

function computeWeeklyBuckets(users: { created_at: string }[]): WeeklyBucket[] {
  const now = new Date();
  const buckets: WeeklyBucket[] = [];
  for (let i = 11; i >= 0; i--) {
    const start = new Date(now);
    start.setDate(start.getDate() - (i + 1) * 7);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setDate(end.getDate() - i * 7);
    end.setHours(23, 59, 59, 999);
    const count = users.filter((u) => {
      const d = new Date(u.created_at);
      return d >= start && d <= end;
    }).length;
    buckets.push({
      label: start.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count,
    });
  }
  return buckets;
}

function uniq(data: { user_id: string }[] | null): number {
  return new Set((data ?? []).map((r) => r.user_id)).size;
}

export default async function HQPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) redirect("/jobs");

  const admin = createAdminClient();

  // ── Parallel data fetches ──────────────────────────────────────────────────
  const [
    authResult,
    { data: profiles },
    { data: subscriptions },
    { data: businessProfiles },
    { data: jobActivity },
    { data: jobsData },
    { data: materialsData },
    { data: receiptsData },
    { data: calcData },
    { data: estimatesData },
    { data: invoicesData },
    { data: sentInvoicesData },
    { data: portalData },
    { data: drivesData },
    { data: mileageData },
    { data: reportTemplatesData },
    { data: shopData },
    { data: punchData },
    { data: documentsData },
    { data: coiData },
    { data: calcPrefsData },
    { data: referralRewardsData },
    { data: trialEventsData },
  ] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("profiles").select("id, is_lifetime, display_name, trials_completed_jobs, contacted_at"),
    admin.from("subscriptions").select("user_id, status"),
    admin.from("business_profiles").select("user_id, business_name, address, owner_name"),
    admin
      .from("jobs")
      .select("user_id, updated_at")
      .order("updated_at", { ascending: false }),
    admin.from("jobs").select("user_id"),
    admin.from("materials").select("user_id"),
    admin.from("receipts").select("user_id"),
    admin.from("jobs").select("user_id").not("calculated_sqft", "is", null),
    admin.from("estimates").select("user_id"),
    admin.from("invoices").select("user_id"),
    admin.from("invoices").select("user_id").not("sent_at", "is", null),
    admin.from("jobs").select("user_id").eq("portal_enabled", true),
    admin.from("drives").select("user_id"),
    admin.from("mileage_logs").select("user_id"),
    admin.from("report_templates").select("user_id"),
    admin.from("shop_inventory").select("user_id"),
    admin.from("punch_list_items").select("user_id"),
    admin.from("documents").select("user_id"),
    admin.from("contact_coi").select("user_id"),
    admin.from("calculator_prefs").select("user_id"),
    admin.from("referral_rewards").select("referrer_user_id, referred_user_id, reward_status, created_at, granted_at"),
    admin.from("trial_events").select("user_id, qualified, trials_completed_count, created_at"),
  ]);

  const authUsers = authResult.data?.users ?? [];

  // ── Build lookup maps ──────────────────────────────────────────────────────
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const subMap = new Map((subscriptions ?? []).map((s) => [s.user_id, s]));
  const bpMap = new Map((businessProfiles ?? []).map((b) => [b.user_id, b]));

  const lastJobMap = new Map<string, string>();
  for (const j of jobActivity ?? []) {
    if (!lastJobMap.has(j.user_id)) lastJobMap.set(j.user_id, j.updated_at);
  }

  const now = new Date();

  function userStatus(
    createdAt: string,
    isLifetime: boolean,
    subStatus: string | null,
    trialsCompletedJobs: number
  ): HQUser["status"] {
    if (isLifetime) return "lifetime";
    if (subStatus === "active" || subStatus === "trialing") return "paying";
    const trialEnd = new Date(createdAt);
    trialEnd.setDate(trialEnd.getDate() + 45);
    const timeOk = now < trialEnd;
    const jobsOk = trialsCompletedJobs < 3;
    return timeOk && jobsOk ? "trial" : "expired";
  }

  function daysLeft(createdAt: string): number | null {
    const trialEnd = new Date(createdAt);
    trialEnd.setDate(trialEnd.getDate() + 45);
    const d = Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000);
    return d > 0 ? d : null;
  }

  const users: HQUser[] = authUsers
    .filter((u) => u.email && !u.email.endsWith("@example.com"))
    .map((u) => {
      const profile = profileMap.get(u.id);
      const sub = subMap.get(u.id);
      const bp = bpMap.get(u.id);
      const isLifetime = profile?.is_lifetime ?? false;
      const subStatus = sub?.status ?? null;
      const trialsCompletedJobs = profile?.trials_completed_jobs ?? 0;
      const status = userStatus(u.created_at, isLifetime, subStatus, trialsCompletedJobs);
      const signIn = u.last_sign_in_at ?? null;
      const jobTs = lastJobMap.get(u.id) ?? null;
      const lastActiveAt =
        signIn && jobTs
          ? signIn > jobTs
            ? signIn
            : jobTs
          : signIn ?? jobTs;
      return {
        id: u.id,
        email: u.email ?? "",
        name:
          profile?.display_name ||
          bp?.business_name ||
          u.email?.split("@")[0] ||
          "",
        businessName: bp?.business_name ?? "",
        location: extractCityState(bp?.address ?? null),
        joinedAt: u.created_at,
        status,
        trialDaysLeft: status === "trial" ? daysLeft(u.created_at) : null,
        lastActiveAt,
      };
    })
    .sort(
      (a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime()
    );

  // ── Recent signups (last 20, enriched) ───────────────────────────────────
  const signups: SignupRow[] = authUsers
    .filter((u) => u.email && !u.email.endsWith("@example.com"))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20)
    .map((u) => {
      const profile = profileMap.get(u.id);
      const bp = bpMap.get(u.id) as { user_id: string; business_name: string | null; address: string | null; owner_name?: string | null } | undefined;
      const sub = subMap.get(u.id);
      const isLifetime = profile?.is_lifetime ?? false;
      const subStatus = sub?.status ?? null;
      const trialsCompletedJobs = profile?.trials_completed_jobs ?? 0;
      const status = userStatus(u.created_at, isLifetime, subStatus, trialsCompletedJobs);
      return {
        id: u.id,
        email: u.email ?? "",
        name: profile?.display_name || bp?.owner_name || u.email?.split("@")[0] || "",
        businessName: bp?.business_name ?? null,
        location: extractCityState(bp?.address ?? null),
        joinedAt: u.created_at,
        status,
        trialDaysLeft: status === "trial" ? daysLeft(u.created_at) : null,
        contactedAt: (profile as { contacted_at?: string | null } | undefined)?.contacted_at ?? null,
        trialsCompletedJobs,
      };
    });

  // ── Summary stats ──────────────────────────────────────────────────────────
  const totalAccounts = users.length;
  const paying = users.filter(
    (u) => u.status === "paying" || u.status === "lifetime"
  ).length;
  const activeTrials = users.filter((u) => u.status === "trial").length;
  const churned = users.filter((u) => u.status === "expired").length;

  // ── Weekly signup buckets ─────────────────────────────────────────────────
  const weeklySignups = computeWeeklyBuckets(authUsers);

  // ── Feature usage rows ────────────────────────────────────────────────────
  const total = totalAccounts || 1;
  const pct = (n: number) => Math.round((n / total) * 100);

  const gpsUsers = Math.max(uniq(drivesData), uniq(mileageData));

  const rawFeatures: { name: string; userCount: number }[] = [
    { name: "Jobs created", userCount: uniq(jobsData) },
    { name: "Materials logged", userCount: uniq(materialsData) },
    { name: "Receipts scanned", userCount: uniq(receiptsData) },
    { name: "Calculator used", userCount: Math.max(uniq(calcData), uniq(calcPrefsData)) },
    { name: "Quote generated", userCount: uniq(estimatesData) },
    { name: "Invoice created", userCount: uniq(invoicesData) },
    { name: "Payment link sent", userCount: uniq(sentInvoicesData) },
    { name: "Client portal enabled", userCount: uniq(portalData) },
    { name: "GPS drive logged", userCount: gpsUsers },
    { name: "MegaPort import attempted", userCount: 0 },
    { name: "Reports generated", userCount: uniq(reportTemplatesData) },
    { name: "Shop inventory used", userCount: uniq(shopData) },
    { name: "Punch list used", userCount: uniq(punchData) },
    { name: "Permit / Doc added", userCount: uniq(documentsData) },
    { name: "COI tracked", userCount: uniq(coiData) },
  ];

  const features: FeatureRow[] = rawFeatures
    .map((f) => ({ ...f, pct: pct(f.userCount) }))
    .sort((a, b) => b.pct - a.pct);

  // ── Trial conversion metrics ──────────────────────────────────────────────────
  const authUserMap = new Map(authUsers.map((u) => [u.id, u]));

  // Avg qualifying jobs for paying users at conversion time
  const payingJobCounts = users
    .filter((u) => u.status === "paying")
    .map((u) => profileMap.get(u.id)?.trials_completed_jobs ?? 0);
  const avgJobsToConvert =
    payingJobCounts.length > 0
      ? Math.round((payingJobCounts.reduce((a, b) => a + b, 0) / payingJobCounts.length) * 10) / 10
      : null;

  // Job gate vs time gate for expired users
  const expiredUsers = users.filter((u) => u.status === "expired");
  const jobGateExpired = expiredUsers.filter(
    (u) => (profileMap.get(u.id)?.trials_completed_jobs ?? 0) >= 3
  ).length;
  const timeGateExpired = expiredUsers.length - jobGateExpired;
  const pctJobGate =
    expiredUsers.length > 0 ? Math.round((jobGateExpired / expiredUsers.length) * 100) : 0;
  const pctTimeGate =
    expiredUsers.length > 0 ? Math.round((timeGateExpired / expiredUsers.length) * 100) : 0;

  // Avg days from signup to first qualifying job
  const qualEvents = (trialEventsData ?? []).filter((e) => e.qualified);
  const firstQualByUser = new Map<string, string>();
  for (const e of qualEvents) {
    const existing = firstQualByUser.get(e.user_id);
    if (!existing || e.created_at < existing) firstQualByUser.set(e.user_id, e.created_at);
  }
  const daysToFirstQual: number[] = [];
  for (const [uid, eventAt] of Array.from(firstQualByUser.entries())) {
    const authUser = authUserMap.get(uid);
    if (!authUser) continue;
    const days = Math.floor(
      (new Date(eventAt).getTime() - new Date(authUser.created_at).getTime()) / 86400000
    );
    if (days >= 0) daysToFirstQual.push(days);
  }
  const avgDaysToFirstQualJob =
    daysToFirstQual.length > 0
      ? Math.round((daysToFirstQual.reduce((a, b) => a + b, 0) / daysToFirstQual.length) * 10) / 10
      : null;

  const trialMetrics: TrialMetrics = {
    avgJobsToConvert,
    avgDaysToFirstQualJob,
    pctJobGate,
    pctTimeGate,
    totalExpired: expiredUsers.length,
    jobGateExpired,
    timeGateExpired,
  };

  // ── Referral stats ───────────────────────────────────────────────────────────
  const rewards = referralRewardsData ?? [];
  const referralCountMap = new Map<string, number>();
  for (const r of rewards) {
    referralCountMap.set(r.referrer_user_id, (referralCountMap.get(r.referrer_user_id) ?? 0) + 1);
  }
  const topReferrers = Array.from(referralCountMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([uid, count]) => {
      const u = users.find((x) => x.id === uid);
      return { name: u?.name || u?.email || uid, email: u?.email || "", count };
    });

  const referralStats: ReferralStats = {
    total_links: new Set(rewards.map((r) => r.referrer_user_id)).size,
    total_completed: rewards.filter((r) => r.reward_status === "granted").length,
    total_pending: rewards.filter((r) => r.reward_status === "pending").length,
    top_referrers: topReferrers,
    log: rewards.map((r) => {
      const referrer = users.find((x) => x.id === r.referrer_user_id);
      const referred = users.find((x) => x.id === r.referred_user_id);
      return {
        referrer_name: referrer?.name || referrer?.email || r.referrer_user_id,
        referred_name: referred?.name || referred?.email || r.referred_user_id,
        created_at: r.created_at,
        granted_at: r.granted_at,
        reward_status: r.reward_status,
      };
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
  };

  return (
    <HQDashboard
      userId={user.id}
      totalAccounts={totalAccounts}
      paying={paying}
      activeTrials={activeTrials}
      churned={churned}
      users={users}
      signups={signups}
      weeklySignups={weeklySignups}
      features={features}
      referralStats={referralStats}
      trialMetrics={trialMetrics}
    />
  );
}
