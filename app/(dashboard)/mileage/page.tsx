import { getDrives } from "@/app/actions/drives";
import { IRS_RATE } from "@/lib/mileage-rate";
import { createClient } from "@/lib/supabase/server";
import { Job } from "@/types";
import MileageClient from "./MileageClient";

export default async function MileagePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [drives, { data: jobs }] = await Promise.all([
    getDrives(),
    supabase.from("jobs").select("id, name").eq("user_id", user!.id)
      .in("status", ["active", "on_hold"]).order("name"),
  ]);

  return (
    <MileageClient
      initialDrives={drives}
      jobs={(jobs ?? []) as Pick<Job, "id" | "name">[]}
      irsRate={IRS_RATE}
    />
  );
}
