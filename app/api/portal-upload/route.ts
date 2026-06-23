import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file      = formData.get("file") as File | null;
    const jobId     = formData.get("jobId") as string | null;
    const token     = formData.get("portalToken") as string | null;

    if (!file || !jobId || !token) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const admin = adminClient();

    const { data: job } = await admin
      .from("jobs")
      .select("id")
      .eq("id", jobId)
      .eq("portal_token", token)
      .eq("portal_enabled", true)
      .single();

    if (!job) {
      return NextResponse.json({ error: "Invalid token" }, { status: 403 });
    }

    const ext  = file.type === "image/png" ? "png" : "jpg";
    const path = `${jobId}/portal-messages/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await admin.storage
      .from("job-photos")
      .upload(path, file, { contentType: file.type || "image/jpeg" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Return the storage path — the bucket is private; images are served via
    // the authorizing /api/portal-photo proxy.
    return NextResponse.json({ path });
  } catch {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
