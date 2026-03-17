import { createClient } from "@/lib/supabase/server";
import { getWeekAssignments, getActiveJobsForAssignment, getFieldMembersForAssignment } from "@/app/actions/assignments";
import CalendarClient from "./CalendarClient";

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday as first day
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export default async function CalendarPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user!.id)
    .maybeSingle();

  const role = profile?.role ?? "owner";
  const weekStart = getWeekStart(new Date());

  const [assignments, jobs, members] = await Promise.all([
    getWeekAssignments(weekStart),
    role === "owner" ? getActiveJobsForAssignment() : Promise.resolve([]),
    role === "owner" ? getFieldMembersForAssignment() : Promise.resolve([]),
  ]);

  return (
    <CalendarClient
      role={role as "owner" | "field_member"}
      initialWeekStart={weekStart}
      initialAssignments={assignments}
      jobs={jobs}
      members={members}
    />
  );
}
