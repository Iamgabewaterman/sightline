import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getBusinessProfile } from "@/app/actions/business-profile";
import ReportsClient from "./ReportsClient";

export const metadata: Metadata = { title: "Reports — Sightline" };

export default async function ReportsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [jobsResult, templatesResult, profile] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, name, job_number, types, status")
      .eq("user_id", user.id)
      .order("name"),
    supabase
      .from("report_templates")
      .select("id, user_id, name, config, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    getBusinessProfile(),
  ]);

  return (
    <ReportsClient
      jobs={(jobsResult.data ?? []) as Array<{ id: string; name: string; job_number: string | null; types: string[] | null; status: string | null }>}
      savedTemplates={(templatesResult.data ?? []) as import("./types").ReportTemplate[]}
      businessProfile={profile}
    />
  );
}
