import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Job } from "@/types";
import EditJobForm from "./EditJobForm";

export default async function EditJobPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, user_id, name, types, status, address, notes, lockbox_code, dim_length, dim_width, dim_height, calculated_sqft, client_id, start_date, completed_date, total_days, paused_at, total_paused_days, estimated_completion_date, portal_token, portal_enabled, job_lat, job_lng, job_number, insurance_claim, created_at, updated_at")
    .eq("id", params.id)
    .single<Job>();

  if (!job) notFound();

  return <EditJobForm job={job} />;
}
