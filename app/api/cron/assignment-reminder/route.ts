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

  // Tomorrow's date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  // All assignments for tomorrow
  const { data: assignments } = await supabase
    .from("job_assignments")
    .select("id, user_id, job_id, jobs(name, address, lockbox_code)")
    .eq("assigned_date", tomorrowStr);

  if (!assignments?.length) return NextResponse.json({ sent: 0 });

  let sent = 0;
  for (const a of assignments) {
    const job = a.jobs as unknown as { name: string; address: string; lockbox_code: string | null } | null;
    if (!job) continue;

    const dedupKey = `assignment_reminder:${a.id}`;
    const ok = await shouldSend(dedupKey);
    if (!ok) continue;

    const lockboxPart = job.lockbox_code ? ` Lockbox: ${job.lockbox_code}` : "";
    await sendPushToUser(a.user_id, {
      title: "Assignment Tomorrow",
      body: `Tomorrow: ${job.name} at ${job.address}.${lockboxPart}`,
      url: "/calendar",
    });
    sent++;
  }

  return NextResponse.json({ sent });
}
