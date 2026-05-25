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

  const results = await Promise.allSettled(
    assignments.map(async (a) => {
      const job = a.jobs as unknown as { name: string; address: string; lockbox_code: string | null } | null;
      if (!job) return false;
      const dedupKey = `assignment_reminder:${a.id}`;
      if (!(await shouldSend(dedupKey))) return false;
      const lockboxPart = job.lockbox_code ? ` Lockbox: ${job.lockbox_code}` : "";
      await sendPushToUser(a.user_id, {
        title: "Assignment Tomorrow",
        body: `Tomorrow: ${job.name} at ${job.address}.${lockboxPart}`,
        url: "/calendar",
      }, "assignment_reminder");
      return true;
    })
  );
  const sent = results.filter((r) => r.status === "fulfilled" && r.value).length;

  return NextResponse.json({ sent });
}
