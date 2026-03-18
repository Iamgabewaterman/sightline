import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const MAX = 10;

function serverSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ jobs: [], clients: [], receipts: [], materials: [], invoices: [] });
  }

  const supabase = serverSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const like = `%${q}%`;

  // ── Step 1: parallel — jobs by name/address, clients, all user jobs ───────
  const [jobsByText, clientResults, allJobsRes] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, name, address, status, types, client_id")
      .eq("user_id", user.id)
      .or(`name.ilike.${like},address.ilike.${like}`)
      .limit(MAX),

    supabase
      .from("clients")
      .select("id, name, company, phone, email")
      .eq("user_id", user.id)
      .or(`name.ilike.${like},company.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
      .limit(MAX),

    supabase
      .from("jobs")
      .select("id, name")
      .eq("user_id", user.id)
      .limit(500),
  ]);

  const jobIds = (allJobsRes.data ?? []).map((j) => j.id);
  const jobNameById: Record<string, string> = Object.fromEntries(
    (allJobsRes.data ?? []).map((j) => [j.id, j.name])
  );

  // ── Jobs by matching client ───────────────────────────────────────────────
  const matchingClientIds = (clientResults.data ?? []).map((c) => c.id);
  let jobsByClient: typeof jobsByText.data = [];
  if (matchingClientIds.length > 0) {
    const { data } = await supabase
      .from("jobs")
      .select("id, name, address, status, types, client_id")
      .eq("user_id", user.id)
      .in("client_id", matchingClientIds)
      .limit(MAX);
    jobsByClient = data ?? [];
  }

  // Deduplicate job results
  type JobRow = { id: string; name: string; address: string | null; status: string; types: string[]; client_id: string | null };
  const jobsMap = new Map<string, JobRow>();
  for (const j of [...(jobsByText.data ?? []), ...(jobsByClient ?? [])] as JobRow[]) {
    if (!jobsMap.has(j.id)) jobsMap.set(j.id, j);
  }
  const jobResults = Array.from(jobsMap.values()).slice(0, MAX);

  // ── Step 2: parallel — materials, receipts, invoices ─────────────────────
  if (jobIds.length === 0) {
    return NextResponse.json({
      jobs: jobResults,
      clients: clientResults.data ?? [],
      receipts: [],
      materials: [],
      invoices: [],
    });
  }

  const [materialRes, receiptRes, invoiceRes] = await Promise.all([
    supabase
      .from("materials")
      .select("id, job_id, name, unit_cost")
      .in("job_id", jobIds)
      .ilike("name", like)
      .limit(MAX),

    supabase
      .from("receipts")
      .select("id, job_id, vendor, amount, created_at, category")
      .in("job_id", jobIds)
      .ilike("vendor", like)
      .limit(MAX),

    supabase
      .from("invoices")
      .select("id, job_id, total_amount, status, client_id")
      .in("job_id", jobIds)
      .limit(200),  // fetch all; filter below
  ]);

  // ── Materials: attach job name ────────────────────────────────────────────
  const materials = (materialRes.data ?? []).map((m) => ({
    id: m.id,
    jobId: m.job_id,
    jobName: jobNameById[m.job_id] ?? "",
    name: m.name,
    unitCost: m.unit_cost,
  }));

  // ── Receipts: attach job name ─────────────────────────────────────────────
  const receipts = (receiptRes.data ?? []).map((r) => ({
    id: r.id,
    jobId: r.job_id,
    jobName: jobNameById[r.job_id] ?? "",
    vendor: r.vendor,
    amount: r.amount,
    createdAt: r.created_at,
    category: r.category,
  }));

  // ── Invoices: attach job name, filter by query ────────────────────────────
  const ql = q.toLowerCase();
  const isNumeric = /^[\d,.$]+$/.test(q.replace(/\s/g, ""));
  const queryAmount = isNumeric ? parseFloat(q.replace(/[$,]/g, "")) : null;

  const allInvoices = (invoiceRes.data ?? []).map((inv) => ({
    id: inv.id,
    jobId: inv.job_id,
    jobName: jobNameById[inv.job_id] ?? "",
    invoiceNumber: `INV-${inv.job_id.slice(0, 8).toUpperCase()}`,
    totalAmount: inv.total_amount,
    status: inv.status,
    clientId: inv.client_id,
  }));

  const filteredInvoices = allInvoices
    .filter((inv) => {
      if (inv.invoiceNumber.toLowerCase().includes(ql)) return true;
      if (inv.jobName.toLowerCase().includes(ql)) return true;
      if (queryAmount !== null && Math.abs(inv.totalAmount - queryAmount) < 1) return true;
      return false;
    })
    .slice(0, MAX);

  // Attach client names to invoice results
  const invoiceClientIds = Array.from(new Set(filteredInvoices.map((i) => i.clientId).filter(Boolean)));
  let clientNameById: Record<string, string> = {};
  if (invoiceClientIds.length > 0) {
    const { data: invClients } = await supabase
      .from("clients")
      .select("id, name")
      .in("id", invoiceClientIds as string[]);
    clientNameById = Object.fromEntries((invClients ?? []).map((c) => [c.id, c.name]));
  }

  const invoices = filteredInvoices.map((inv) => ({
    id: inv.id,
    jobId: inv.jobId,
    jobName: inv.jobName,
    invoiceNumber: inv.invoiceNumber,
    totalAmount: inv.totalAmount,
    status: inv.status,
    clientName: inv.clientId ? (clientNameById[inv.clientId] ?? null) : null,
  }));

  return NextResponse.json({ jobs: jobResults, clients: clientResults.data ?? [], receipts, materials, invoices });
}
