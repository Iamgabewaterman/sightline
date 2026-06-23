import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Authenticated image proxy for the private `job-photos` bucket.
// Verifies the logged-in user owns the job the photo belongs to (the first path
// segment is the job id), then streams the bytes via the service role.
export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path");
  if (!path || path.includes("..")) {
    return new Response("Bad request", { status: 400 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const jobId = path.split("/")[0];
  const { data: job } = await supabase
    .from("jobs")
    .select("id")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!job) return new Response("Forbidden", { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("job-photos").download(path);
  if (error || !data) return new Response("Not found", { status: 404 });

  const buf = await data.arrayBuffer();
  return new Response(buf, {
    headers: {
      "Content-Type": data.type || "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
