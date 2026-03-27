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
  const cutoff = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
  const today = new Date().toISOString().slice(0, 10);

  // All active jobs
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, user_id, name")
    .eq("status", "active");

  if (!jobs?.length) return NextResponse.json({ sent: 0 });

  let sent = 0;
  for (const job of jobs) {
    // Check for any activity in the last 3 days
    const [{ count: laborCount }, { count: photoCount }, { count: logCount }] = await Promise.all([
      supabase.from("labor_logs").select("id", { count: "exact", head: true })
        .eq("job_id", job.id).gte("created_at", cutoff),
      supabase.from("photos").select("id", { count: "exact", head: true })
        .eq("job_id", job.id).gte("created_at", cutoff),
      supabase.from("daily_logs").select("id", { count: "exact", head: true })
        .eq("job_id", job.id).gte("created_at", cutoff),
    ]);

    const hasActivity = (laborCount ?? 0) + (photoCount ?? 0) + (logCount ?? 0) > 0;
    if (hasActivity) continue;

    const dedupKey = `no_activity:${job.id}:${today}`;
    const ok = await shouldSend(dedupKey);
    if (!ok) continue;

    await sendPushToUser(job.user_id, {
      title: "No Activity",
      body: `No activity logged on ${job.name} in 3 days — is everything on track?`,
      url: `/jobs/${job.id}`,
    }, "no_activity_3_days");
    sent++;
  }

  return NextResponse.json({ sent });
}
