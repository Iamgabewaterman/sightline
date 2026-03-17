import { createServerClient } from "@supabase/ssr";
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
  const isAuthPage = pathname === "/login" || pathname === "/signup";
  const isSubscribePage = pathname.startsWith("/subscribe");
  const isApiRoute = pathname.startsWith("/api");
  const isAuthCallback = pathname.startsWith("/auth");

  // Not logged in → send to login
  if (!user && !isAuthPage && !isAuthCallback) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Logged in and hitting auth pages → send to dashboard
  if (user && isAuthPage) {
    return NextResponse.redirect(new URL("/jobs", request.url));
  }

  if (user && !isAuthPage && !isApiRoute && !isAuthCallback) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_lifetime, role, can_see_financials, can_see_all_jobs, can_see_client_info")
      .eq("id", user.id)
      .maybeSingle();

    // ── Field member restrictions ────────────────────────────────────────────
    if (profile?.role === "field_member") {
      const blocked = OWNER_ONLY_ROUTES.some((r) => pathname.startsWith(r));

      // Check financials route exceptions
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
    if (!isSubscribePage && !profile?.is_lifetime) {
      const trialEndsAt = new Date(user.created_at);
      trialEndsAt.setMonth(trialEndsAt.getMonth() + 3);
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
