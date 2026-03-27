import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToUser } from "@/lib/push";
import { shouldSend } from "@/lib/notif-dedup";

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

  // Find all invoices that are sent (not paid) and past due date
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, job_id, total_amount, due_date, user_id, jobs(name)")
    .eq("status", "sent")
    .lt("due_date", today);

  if (!invoices?.length) return NextResponse.json({ sent: 0 });

  let sent = 0;
  for (const inv of invoices) {
    const job = inv.jobs as unknown as { name: string } | null;
    const dueDate = new Date(inv.due_date + "T00:00:00");
    const daysOverdue = Math.floor((Date.now() - dueDate.getTime()) / 86400000);
    const invNum = `INV-${inv.job_id.slice(0, 8).toUpperCase()}`;

    const dedupKey = `invoice_overdue:${inv.id}:${today}`;
    const ok = await shouldSend(dedupKey);
    if (!ok) continue;

    await sendPushToUser(inv.user_id, {
      title: "Invoice Overdue",
      body: `${invNum} for ${job?.name ?? "a job"} is overdue — ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} past due`,
      url: `/jobs`,
    }, "invoice_overdue");
    sent++;
  }

  return NextResponse.json({ sent });
}
