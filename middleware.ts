import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

// Routes field members cannot access
const OWNER_ONLY_ROUTES = [
  "/tax",
  "/mileage",
  "/clients",
  "/import",
  "/portfolio",
  "/receipts",
  "/settings",
  "/people",
  "/profit",
  "/reports",      // covers /reports and /reports-hub
  "/inventory",
  "/calculator",
];

// ── Short-lived middleware cache (Fix 14) ───────────────────────────────────
// Eliminates the profile + subscription DB reads on every navigation. Keyed by
// user id, 30s TTL. Module scope persists across requests on a warm instance.
const MW_TTL_MS = 30_000;
type MwProfile = {
  is_lifetime: boolean | null;
  role: string | null;
  can_see_financials: boolean | null;
  can_see_all_jobs: boolean | null;
  can_see_client_info: boolean | null;
  onboarding_complete: boolean | null;
  trials_completed_jobs: number | null;
};
type MwCacheEntry = { profile: MwProfile | null; sub: { status: string } | null; at: number };
const mwCache = new Map<string, MwCacheEntry>();

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — must call getUser(), not getSession()
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // ── HQ admin route — only gabew595@gmail.com ────────────────────────────
  if (pathname.startsWith("/hq")) {
    if (!user) return NextResponse.redirect(new URL("/login", request.url));
    if (user.email !== "gabew595@gmail.com")
      return NextResponse.redirect(new URL("/jobs", request.url));
    return supabaseResponse;
  }

  // ── Public routes — never redirect regardless of auth or subscription ────
  // This must be checked before any auth or subscription logic to prevent loops.
  const isPublicRoute =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/subscribe") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/pay") ||
    pathname.startsWith("/portal") ||
    pathname.startsWith("/sign") ||
    pathname.startsWith("/demo");

  if (isPublicRoute) {
    // Logged-in users visiting auth pages or landing → send to dashboard
    if (user && (pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/signup"))) {
      return NextResponse.redirect(new URL("/jobs", request.url));
    }
    return supabaseResponse;
  }

  const isOnboardingRoute = pathname.startsWith("/onboarding");

  // Not logged in → send to login
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Logged-in user on a protected route — check profile and subscription
  {
    // Serve profile + subscription from the short-lived cache when possible,
    // otherwise read once (and cache) so navigation isn't 2 DB round-trips each.
    let profile: MwProfile | null;
    let cachedSub: { status: string } | null = null;
    const cached = mwCache.get(user.id);
    if (cached && Date.now() - cached.at < MW_TTL_MS) {
      profile = cached.profile;
      cachedSub = cached.sub;
    } else {
      // Use service-role client so RLS never blocks the profile read in Edge Runtime
      const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const { data } = await admin
        .from("profiles")
        .select("is_lifetime, role, can_see_financials, can_see_all_jobs, can_see_client_info, onboarding_complete, trials_completed_jobs")
        .eq("id", user.id)
        .maybeSingle();
      profile = (data as MwProfile) ?? null;

      // Owners that aren't lifetime may need the subscription status — fetch it
      // now so it's cached alongside the profile.
      if (profile && profile.role !== "field_member" && !profile.is_lifetime) {
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("status")
          .eq("user_id", user.id)
          .maybeSingle();
        cachedSub = sub ?? null;
      }
      mwCache.set(user.id, { profile, sub: cachedSub, at: Date.now() });
    }

    // ── Onboarding redirect (owners only, once) ──────────────────────────────
    if (
      profile &&
      !profile.onboarding_complete &&
      profile.role !== "field_member" &&
      !isOnboardingRoute
    ) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }

    // ── Field member restrictions ─────────────────────────────────────────────
    if (profile?.role === "field_member") {
      const blocked = OWNER_ONLY_ROUTES.some((r) => pathname.startsWith(r));
      const wantsFinancials = pathname.startsWith("/tax") || pathname.startsWith("/mileage") || pathname.startsWith("/receipts");
      if (wantsFinancials && profile.can_see_financials) {
        // allowed
      } else if (blocked) {
        return NextResponse.redirect(new URL("/jobs", request.url));
      }
      // Field members skip Stripe subscription check — they're free
      return supabaseResponse;
    }

    // ── Owner subscription enforcement ───────────────────────────────────────
    if (!profile?.is_lifetime) {
      // Hybrid trial: active only while BOTH conditions hold —
      // time has not expired AND fewer than 3 qualifying jobs completed.
      const trialEndsAt = new Date(user.created_at);
      trialEndsAt.setDate(trialEndsAt.getDate() + 45);
      const timeOk = new Date() < trialEndsAt;
      const jobsOk = (profile?.trials_completed_jobs ?? 0) < 3;
      const onTrial = timeOk && jobsOk;

      if (!onTrial) {
        const isActive = cachedSub?.status === "active" || cachedSub?.status === "trialing";
        if (!isActive) {
          return NextResponse.redirect(new URL("/subscribe", request.url));
        }
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
