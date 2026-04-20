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
];

// Routes field members CAN access (whitelist within dashboard)
const FIELD_MEMBER_ALLOWED = [
  "/jobs",
  "/account",
  "/subscribe",
];

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

  // ── Public routes — never redirect regardless of auth or subscription ────
  // This must be checked before any auth or subscription logic to prevent loops.
  const isPublicRoute =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/subscribe") ||
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
    // Use service-role client so RLS never blocks the profile read in Edge Runtime
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: profile } = await admin
      .from("profiles")
      .select("is_lifetime, role, can_see_financials, can_see_all_jobs, can_see_client_info, onboarding_complete")
      .eq("id", user.id)
      .maybeSingle();

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
      const trialEndsAt = new Date(user.created_at);
      trialEndsAt.setDate(trialEndsAt.getDate() + 30);
      const onTrial = new Date() < trialEndsAt;

      if (!onTrial) {
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("status")
          .eq("user_id", user.id)
          .maybeSingle();

        const isActive = sub?.status === "active" || sub?.status === "trialing";
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
