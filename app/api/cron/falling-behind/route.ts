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

  // Active jobs where estimated_completion_date has passed
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, user_id, name, estimated_completion_date")
    .eq("status", "active")
    .not("estimated_completion_date", "is", null)
    .lt("estimated_completion_date", today);

  if (!jobs?.length) return NextResponse.json({ sent: 0 });

  let sent = 0;
  for (const job of jobs) {
    const dedupKey = `falling_behind:${job.id}:${today}`;
    const ok = await shouldSend(dedupKey);
    if (!ok) continue;

    await sendPushToUser(job.user_id, {
      title: "Behind Schedule",
      body: `${job.name} is past its estimated completion date`,
      url: `/jobs/${job.id}`,
    }, "job_falling_behind");
    sent++;
  }

  return NextResponse.json({ sent });
}
