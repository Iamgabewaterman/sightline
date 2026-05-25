import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToUser } from "@/lib/push";
import { shouldSend } from "@/lib/notif-dedup";
import { getWeather } from "@/lib/weather";

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

  // All active jobs with stored coordinates
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, user_id, name, job_lat, job_lng")
    .eq("status", "active")
    .not("job_lat", "is", null)
    .not("job_lng", "is", null);

  if (!jobs?.length) return NextResponse.json({ sent: 0 });

  const results = await Promise.allSettled(
    jobs.map(async (job) => {
      const weather = await getWeather(job.job_lat, job.job_lng);
      if (!weather) return false;
      if (weather.precipNextDay < 60) return false;
      const dedupKey = `weather_alert:${job.id}:${today}`;
      if (!(await shouldSend(dedupKey))) return false;
      await sendPushToUser(job.user_id, {
        title: `Rain forecast at ${job.name}`,
        body: `${weather.precipNextDay}% chance of precipitation tomorrow — plan accordingly.`,
        url: `/jobs/${job.id}`,
      });
      return true;
    })
  );
  const sent = results.filter((r) => r.status === "fulfilled" && r.value).length;

  return NextResponse.json({ sent });
}
