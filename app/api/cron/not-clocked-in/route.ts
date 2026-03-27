import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToUser } from "@/lib/push";
import { shouldSend } from "@/lib/notif-dedup";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = adminClient();
  const today = new Date().toISOString().slice(0, 10);

  // All job assignments for today
  const { data: assignments } = await supabase
    .from("job_assignments")
    .select("id, user_id, job_id, jobs(name, address, user_id), profiles(display_name)")
    .eq("assigned_date", today);

  if (!assignments?.length) return NextResponse.json({ sent: 0 });

  let sent = 0;
  for (const a of assignments) {
    const job = a.jobs as unknown as { name: string; address: string; user_id: string } | null;
    const profile = a.profiles as unknown as { display_name: string | null } | null;
    if (!job) continue;

    // Check if this field member has a clock session for this job today
    const { count } = await supabase
      .from("clock_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", a.user_id)
      .eq("job_id", a.job_id)
      .gte("clocked_in_at", `${today}T00:00:00`);

    if ((count ?? 0) > 0) continue;

    const dedupKey = `not_clocked_in:${a.id}:${today}`;
    const ok = await shouldSend(dedupKey);
    if (!ok) continue;

    const memberName = profile?.display_name ?? "A crew member";

    // Notify owner
    await sendPushToUser(job.user_id, {
      title: "Crew Not Clocked In",
      body: `${memberName} hasn't clocked in for ${job.name} yet`,
      url: `/jobs/${a.job_id}`,
    }, "not_clocked_in");

    // Notify the field member
    await sendPushToUser(a.user_id, {
      title: "Don't Forget to Clock In",
      body: `You have ${job.name} today at ${job.address} — don't forget to clock in`,
      url: "/calendar",
    }, "not_clocked_in");

    sent++;
  }

  return NextResponse.json({ sent });
}
