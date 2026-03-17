import { getMileageLogs } from "@/app/actions/mileage";
import { IRS_RATE } from "@/lib/mileage-rate";
import { createClient } from "@/lib/supabase/server";
import { Job } from "@/types";
import MileageClient from "./MileageClient";

export default async function MileagePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [logs, { data: jobs }] = await Promise.all([
    getMileageLogs(),
    supabase.from("jobs").select("id, name").eq("user_id", user!.id)
      .in("status", ["active", "on_hold"]).order("name"),
  ]);

  const currentYear = new Date().getFullYear();
  const ytdLogs = logs.filter((l) => new Date(l.log_date).getFullYear() === currentYear);
  const ytdMiles = ytdLogs.reduce((s, l) => s + Number(l.miles), 0);
  const ytdDeduction = ytdLogs.reduce((s, l) => s + Number(l.deduction), 0);

  return (
    <MileageClient
      initialLogs={logs}
      jobs={(jobs ?? []) as Pick<Job, "id" | "name">[]}
      ytdMiles={ytdMiles}
      ytdDeduction={ytdDeduction}
      irsRate={IRS_RATE}
    />
  );
}
