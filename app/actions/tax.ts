"use server";

import { createClient } from "@/lib/supabase/server";
import { TaxTransaction, ExpenseCategory } from "@/types";

export interface TaxReportData {
  year: number;
  revenue: TaxTransaction[];
  expenses: TaxTransaction[];
  availableYears: number[];
}

export async function getTaxReport(year: number): Promise<TaxReportData> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { year, revenue: [], expenses: [], availableYears: [year] };

  const yearStart = `${year}-01-01T00:00:00.000Z`;
  const yearEnd   = `${year + 1}-01-01T00:00:00.000Z`;

  // Fetch all data in parallel
  const [
    { data: invoices },
    { data: materials },
    { data: laborLogs },
    { data: receipts },
    { data: changeOrders },
    { data: mileageLogs },
    { data: allJobs },
    { data: allInvoicesForYears },
  ] = await Promise.all([
    // Paid invoices = revenue
    supabase.from("invoices").select("id, job_id, total_amount, paid_at")
      .eq("user_id", user.id).eq("status", "paid")
      .gte("paid_at", yearStart).lt("paid_at", yearEnd),
    // Materials
    supabase.from("materials").select("id, job_id, name, quantity_ordered, quantity_used, unit_cost, category, created_at")
      .eq("user_id", user.id)
      .gte("created_at", yearStart).lt("created_at", yearEnd),
    // Labor logs
    supabase.from("labor_logs").select("id, job_id, crew_name, hours, rate, category, created_at")
      .eq("user_id", user.id)
      .gte("created_at", yearStart).lt("created_at", yearEnd),
    // Receipts
    supabase.from("receipts").select("id, job_id, vendor, amount, category, created_at")
      .eq("user_id", user.id).not("amount", "is", null)
      .gte("created_at", yearStart).lt("created_at", yearEnd),
    // Change orders (positive = cost)
    supabase.from("change_orders").select("id, job_id, description, amount, category, created_at")
      .eq("user_id", user.id)
      .gte("created_at", yearStart).lt("created_at", yearEnd),
    // Mileage
    supabase.from("mileage_logs").select("id, job_id, description, miles, deduction, log_date")
      .eq("user_id", user.id)
      .gte("log_date", `${year}-01-01`).lte("log_date", `${year}-12-31`),
    // All jobs for name lookup
    supabase.from("jobs").select("id, name").eq("user_id", user.id),
    // Get all years with paid invoices for year selector
    supabase.from("invoices").select("paid_at").eq("user_id", user.id).eq("status", "paid").not("paid_at", "is", null),
  ]);

  const jobMap = new Map((allJobs ?? []).map((j: { id: string; name: string }) => [j.id, j.name]));

  // Revenue
  const revenue: TaxTransaction[] = (invoices ?? []).map((inv) => ({
    date: inv.paid_at!,
    description: "Invoice payment",
    job_name: jobMap.get(inv.job_id) ?? "Unknown Job",
    category: "other" as ExpenseCategory, // revenue doesn't use category
    amount: Number(inv.total_amount),
    source: "receipt" as const,
  }));

  // Expenses
  const expenses: TaxTransaction[] = [];

  (materials ?? []).forEach((m) => {
    const qty = m.quantity_used ?? m.quantity_ordered;
    if (m.unit_cost === null) return;
    const amount = Number(qty) * Number(m.unit_cost);
    if (amount <= 0) return;
    expenses.push({
      date: m.created_at,
      description: m.name,
      job_name: jobMap.get(m.job_id) ?? "Unknown Job",
      category: (m.category as ExpenseCategory) || "materials",
      amount,
      source: "materials",
    });
  });

  (laborLogs ?? []).forEach((l) => {
    const amount = Number(l.hours) * Number(l.rate);
    expenses.push({
      date: l.created_at,
      description: `${l.crew_name} (${Number(l.hours)}h @ $${Number(l.rate)}/hr)`,
      job_name: jobMap.get(l.job_id) ?? "Unknown Job",
      category: (l.category as ExpenseCategory) || "labor",
      amount,
      source: "labor",
    });
  });

  (receipts ?? []).forEach((r) => {
    if (!r.amount) return;
    expenses.push({
      date: r.created_at,
      description: r.vendor ?? "Receipt",
      job_name: jobMap.get(r.job_id) ?? "Unknown Job",
      category: (r.category as ExpenseCategory) || "other",
      amount: Number(r.amount),
      source: "receipt",
    });
  });

  (changeOrders ?? []).forEach((co) => {
    const amount = Number(co.amount);
    if (amount <= 0) return; // credits don't count as expenses
    expenses.push({
      date: co.created_at,
      description: co.description,
      job_name: jobMap.get(co.job_id) ?? "Unknown Job",
      category: (co.category as ExpenseCategory) || "other",
      amount,
      source: "change_order",
    });
  });

  (mileageLogs ?? []).forEach((m) => {
    expenses.push({
      date: m.log_date,
      description: `${m.description} (${Number(m.miles)} mi)`,
      job_name: jobMap.get(m.job_id) ?? "No job",
      category: "vehicle",
      amount: Number(m.deduction),
      source: "mileage",
    });
  });

  // Available years
  const yearsSet = new Set<number>();
  const currentYear = new Date().getFullYear();
  yearsSet.add(currentYear);
  (allInvoicesForYears ?? []).forEach((inv: { paid_at: string }) => {
    if (inv.paid_at) yearsSet.add(new Date(inv.paid_at).getFullYear());
  });
  const availableYears = Array.from(yearsSet).sort((a, b) => b - a);

  return { year, revenue, expenses, availableYears };
}
