import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import HQDashboard, {
  type HQUser,
  type FeatureRow,
  type WeeklyBucket,
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
  ] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("profiles").select("id, is_lifetime, display_name"),
    admin.from("subscriptions").select("user_id, status"),
    admin.from("business_profiles").select("user_id, business_name, address"),
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
    subStatus: string | null
  ): HQUser["status"] {
    if (isLifetime) return "lifetime";
    if (subStatus === "active" || subStatus === "trialing") return "paying";
    const trialEnd = new Date(createdAt);
    trialEnd.setDate(trialEnd.getDate() + 30);
    return now < trialEnd ? "trial" : "expired";
  }

  function daysLeft(createdAt: string): number | null {
    const trialEnd = new Date(createdAt);
    trialEnd.setDate(trialEnd.getDate() + 30);
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
      const status = userStatus(u.created_at, isLifetime, subStatus);
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

  return (
    <HQDashboard
      userId={user.id}
      totalAccounts={totalAccounts}
      paying={paying}
      activeTrials={activeTrials}
      churned={churned}
      users={users}
      weeklySignups={weeklySignups}
      features={features}
    />
  );
}
