import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToUser } from "@/lib/push";
import { shouldSend } from "@/lib/notif-dedup";

export const maxDuration = 10;

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

  // Jobs starting today
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, user_id, name")
    .eq("status", "active")
    .eq("start_date", today);

  if (!jobs?.length) return NextResponse.json({ sent: 0 });

  const results = await Promise.allSettled(
    jobs.map(async (job) => {
      const { count } = await supabase
        .from("job_assignments")
        .select("id", { count: "exact", head: true })
        .eq("job_id", job.id)
        .eq("assigned_date", today);
      if ((count ?? 0) > 0) return false;
      const dedupKey = `no_crew_today:${job.id}:${today}`;
      if (!(await shouldSend(dedupKey))) return false;
      await sendPushToUser(job.user_id, {
        title: "No Crew Assigned",
        body: `${job.name} starts today and has no crew assigned`,
        url: `/jobs/${job.id}`,
      }, "no_crew_assigned");
      return true;
    })
  );
  const sent = results.filter((r) => r.status === "fulfilled" && r.value).length;

  return NextResponse.json({ sent });
}
