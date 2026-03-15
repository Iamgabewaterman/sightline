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
    .select("*")
    .eq("id", params.id)
    .single<Job>();

  if (!job) notFound();

  return <EditJobForm job={job} />;
}
