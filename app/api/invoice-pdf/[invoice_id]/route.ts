import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateInvoicePDFBytes } from "@/lib/generateInvoicePDF";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const PAYMENT_TERMS_LABELS: Record<string, string> = {
  due_on_receipt: "Due on Receipt",
  net_15: "Net 15",
  net_30: "Net 30",
  net_45: "Net 45",
};

export async function GET(
  request: NextRequest,
  { params }: { params: { invoice_id: string } }
) {
  const { searchParams } = request.nextUrl;
  const jobId = searchParams.get("job_id");
  const token = searchParams.get("token");

  if (!jobId || !token) {
    return new Response("Missing job_id or token", { status: 400 });
  }

  const supabase = adminClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, name, address, job_number, portal_token, portal_enabled, user_id")
    .eq("id", jobId)
    .eq("portal_token", token)
    .eq("portal_enabled", true)
    .maybeSingle();

  if (!job) {
    return new Response("Not found", { status: 404 });
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, job_id, client_id, status, payment_terms, due_date, notes, paid_at, total_amount, created_at, client_line_items")
    .eq("id", params.invoice_id)
    .eq("job_id", jobId)
    .maybeSingle();

  if (!invoice) {
    return new Response("Invoice not found", { status: 404 });
  }

  const [
    { data: milestones },
    { data: client },
    { data: businessProfile },
    { data: changeOrders },
  ] = await Promise.all([
    supabase
      .from("payment_milestones")
      .select("label, amount, due_date, status")
      .eq("invoice_id", invoice.id)
      .order("sort_order"),
    invoice.client_id
      ? supabase.from("clients").select("name, company, address, phone, email").eq("id", invoice.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("business_profiles")
      .select("business_name, owner_name, license_number, address, phone, email")
      .eq("user_id", job.user_id)
      .maybeSingle(),
    supabase
      .from("change_orders")
      .select("description, amount")
      .eq("job_id", jobId)
      .order("created_at"),
  ]);

  const pdfData = {
    contractorEmail: businessProfile?.email ?? "",
    jobName: job.name,
    jobAddress: job.address ?? "",
    jobNumber: job.job_number ?? null,
    date: invoice.created_at
      ? new Date(invoice.created_at).toLocaleDateString("en-US")
      : new Date().toLocaleDateString("en-US"),
    invoiceNumber: `INV-${invoice.id.slice(0, 8).toUpperCase()}`,
    invoiceId: invoice.id,
    addons: (changeOrders ?? []).map((co: { description: string; amount: string | number }) => ({
      name: co.description,
      amount: Number(co.amount),
    })),
    grandTotal: Number(invoice.total_amount ?? 0),
    businessProfile: businessProfile ?? null,
    client: client ?? null,
    paymentTermsLabel: invoice.payment_terms
      ? (PAYMENT_TERMS_LABELS[invoice.payment_terms] ?? invoice.payment_terms)
      : undefined,
    dueDate: invoice.due_date ?? null,
    notes: invoice.notes ?? null,
    status: invoice.status as "unpaid" | "sent" | "pending" | "partial" | "paid",
    paidDate: invoice.paid_at
      ? new Date(invoice.paid_at).toLocaleDateString("en-US")
      : null,
    clientLineItems: (invoice.client_line_items as Array<{ name: string; amount: number }> | null) ?? [],
    milestones: (milestones ?? []).map((m: { label: string; amount: string | number; due_date: string | null; status: string }) => ({
      label: m.label,
      amount: Number(m.amount),
      due_date: m.due_date,
      status: m.status,
    })),
  };

  try {
    const pdfBytes = await generateInvoicePDFBytes(pdfData);
    const safeName = job.name.replace(/[^a-z0-9]/gi, "-").toLowerCase();
    return new Response(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${safeName}.pdf"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (err) {
    console.error("[invoice-pdf]", err);
    return new Response("PDF generation failed", { status: 500 });
  }
}
