import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToUser } from "@/lib/push";
import { shouldSend } from "@/lib/notif-dedup";

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
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const in30 = new Date(today); in30.setDate(in30.getDate() + 30);
  const in7  = new Date(today); in7.setDate(in7.getDate() + 7);

  // Fetch all COIs with an expiration date, joined with contact name
  const { data: cois } = await supabase
    .from("contact_coi")
    .select("contact_id, user_id, expiration_date, contacts(name)")
    .not("expiration_date", "is", null);

  if (!cois?.length) return NextResponse.json({ sent: 0 });

  const todayStr = today.toISOString().slice(0, 10);
  const results = await Promise.allSettled(
    cois.map(async (coi) => {
      const expDate = new Date(coi.expiration_date + "T00:00:00");
      const daysUntil = Math.floor((expDate.getTime() - today.getTime()) / 86400000);
      const contactName = (coi.contacts as unknown as { name: string } | null)?.name ?? "A subcontractor";
      if (daysUntil === 30) {
        const key = `coi_30day:${coi.contact_id}:${todayStr}`;
        if (!(await shouldSend(key))) return false;
        await sendPushToUser(coi.user_id, {
          title: "COI Expiring in 30 Days",
          body: `${contactName} certificate of insurance expires in 30 days — upload a new COI in People.`,
          url: "/people",
        }, "coi_expiration");
        return true;
      } else if (daysUntil === 7) {
        const key = `coi_7day:${coi.contact_id}:${todayStr}`;
        if (!(await shouldSend(key))) return false;
        await sendPushToUser(coi.user_id, {
          title: "COI Expiring in 7 Days",
          body: `${contactName} certificate of insurance expires in 7 days — upload a new COI in People.`,
          url: "/people",
        }, "coi_expiration");
        return true;
      } else if (daysUntil === 0) {
        const key = `coi_expired:${coi.contact_id}:${todayStr}`;
        if (!(await shouldSend(key))) return false;
        await sendPushToUser(coi.user_id, {
          title: "COI Expired",
          body: `${contactName} COI has expired — do not assign to jobs until renewed.`,
          url: "/people",
        }, "coi_expiration");
        return true;
      }
      return false;
    })
  );
  const sent = results.filter((r) => r.status === "fulfilled" && r.value).length;

  return NextResponse.json({ sent });
}
