import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Public image proxy for the homeowner portal. No login — authorization is the
// job's portal token (the same token already in the portal URL). Verifies the
// token, that the portal is enabled, and that the requested path belongs to the
// job, then streams the bytes via the service role.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const path = sp.get("path");
  const jobId = sp.get("job");
  const token = sp.get("token");

  if (!path || !jobId || !token || path.includes("..") || !path.startsWith(`${jobId}/`)) {
    return new Response("Bad request", { status: 400 });
  }

  const admin = createAdminClient();
  const { data: job } = await admin
    .from("jobs")
    .select("id")
    .eq("id", jobId)
    .eq("portal_token", token)
    .eq("portal_enabled", true)
    .maybeSingle();
  if (!job) return new Response("Forbidden", { status: 403 });

  const { data, error } = await admin.storage.from("job-photos").download(path);
  if (error || !data) return new Response("Not found", { status: 404 });

  const buf = await data.arrayBuffer();
  return new Response(buf, {
    headers: {
      "Content-Type": data.type || "image/jpeg",
      "Cache-Control": "private, max-age=600",
    },
  });
}
