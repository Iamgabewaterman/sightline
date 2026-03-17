import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/jobs";

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Called from a Server Component — cookies will be set by middleware
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Auto-setup profile after email confirmation
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const inviteCode = user.user_metadata?.invite_code as string | undefined;

        // Check if profile already exists
        const { data: existing } = await supabase
          .from("profiles")
          .select("id, role, company_id")
          .eq("id", user.id)
          .maybeSingle();

        if (!existing) {
          if (inviteCode) {
            // Field member joining a team
            const { data: company } = await supabase
              .from("companies")
              .select("id")
              .eq("invite_code", inviteCode.toUpperCase())
              .maybeSingle();

            if (company) {
              await supabase.from("profiles").insert({
                id: user.id,
                role: "field_member",
                company_id: company.id,
              });
            } else {
              // Invalid code — create as owner with no company, handle in UI
              await supabase.from("profiles").insert({ id: user.id, role: "owner" });
            }
          } else {
            // Owner signup — create company + profile
            let code = generateInviteCode();
            let companyId: string | null = null;
            for (let i = 0; i < 5; i++) {
              const { data: company } = await supabase
                .from("companies")
                .insert({ owner_user_id: user.id, invite_code: code })
                .select("id")
                .single();
              if (company) { companyId = company.id; break; }
              code = generateInviteCode();
            }
            await supabase.from("profiles").insert({
              id: user.id,
              role: "owner",
              company_id: companyId,
            });
          }
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
