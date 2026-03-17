import BottomTabBar from "@/components/BottomTabBar";
import { ClockProvider } from "@/components/ClockContext";
import ClockWidget from "@/components/ClockWidget";
import { RoleProvider, RoleData } from "@/components/RoleContext";
import { createClient } from "@/lib/supabase/server";

async function fetchRoleData(userId: string): Promise<RoleData> {
  const supabase = createClient();

  // Get profile role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", userId)
    .maybeSingle();

  if (!profile || profile.role !== "field_member") {
    return { role: "owner", can_see_financials: true, can_see_all_jobs: true, can_see_client_info: true };
  }

  // Get field member permissions from company_members
  const { data: member } = await supabase
    .from("company_members")
    .select("can_see_financials, can_see_all_jobs, can_see_client_info")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    role: "field_member",
    can_see_financials: member?.can_see_financials ?? false,
    can_see_all_jobs: member?.can_see_all_jobs ?? false,
    can_see_client_info: member?.can_see_client_info ?? false,
  };
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const roleData = user ? await fetchRoleData(user.id) : {
    role: "owner" as const,
    can_see_financials: true,
    can_see_all_jobs: true,
    can_see_client_info: true,
  };

  return (
    <RoleProvider value={roleData}>
      <ClockProvider>
        <div className="pb-[calc(56px+env(safe-area-inset-bottom))]">
          {children}
        </div>
        <ClockWidget />
        <BottomTabBar />
      </ClockProvider>
    </RoleProvider>
  );
}
