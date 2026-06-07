// Shared types and config for the report builder — no server/client directives.

export type ReportType =
  | "job_profitability"
  | "materials_cost"
  | "labor"
  | "tax_summary"
  | "invoices_payments"
  | "mileage"
  | "waste_variance"
  | "custom";

// Legacy key aliases — old saved templates get migrated on load
export const LEGACY_TYPE_MAP: Record<string, ReportType> = {
  job_summary:     "job_profitability",
  materials:       "materials_cost",
  profitability:   "job_profitability",
  mileage_tax:     "mileage",
  full_business:   "custom",
};

export type DatePreset =
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "last_quarter"
  | "this_year"
  | "last_year"
  | "all_time"
  | "custom";

export type JobFilterType = "all" | "type" | "status" | "specific";
export type ExportFormat = "pdf" | "csv";

export interface ReportConfig {
  reportType: ReportType;
  datePreset: DatePreset;
  dateStart?: string;
  dateEnd?: string;
  jobFilterType: JobFilterType;
  jobFilterValues: string[];
  columns: string[];
  exportFormat: ExportFormat;
  customSections?: ReportType[];
  includeWatermark?: boolean;
}

export interface ReportSection {
  title: string;
  type: ReportType;
  rows: Record<string, unknown>[];
  totalRows?: number;
}

export interface ReportResult {
  rows: Record<string, unknown>[];
  sections?: ReportSection[];
  totalRows?: number;
  error?: string;
}

export interface ReportTemplate {
  id: string;
  user_id: string;
  name: string;
  config: ReportConfig;
  created_at: string;
}

export interface ColumnDef {
  key: string;
  label: string;
}

// ── Column definitions per report type ───────────────────────────────────────

export const REPORT_TYPE_CONFIG: Record<
  ReportType,
  { label: string; description: string; icon: string; columns: ColumnDef[] }
> = {
  job_profitability: {
    label: "Job Profitability Report",
    description: "Contract amounts, costs, margin, and collection status per job",
    icon: "📊",
    columns: [
      { key: "job_name",             label: "Job Name" },
      { key: "job_number",           label: "Job #" },
      { key: "client_name",          label: "Client" },
      { key: "job_types",            label: "Type(s)" },
      { key: "start_date",           label: "Start Date" },
      { key: "completion_date",      label: "Completion Date" },
      { key: "contract_amount",      label: "Contract Amount" },
      { key: "materials_cost",       label: "Materials Cost" },
      { key: "labor_cost",           label: "Labor Cost" },
      { key: "gross_profit",         label: "Gross Profit" },
      { key: "margin_pct",           label: "Margin %" },
      { key: "invoice_status",       label: "Invoice Status" },
      { key: "amount_collected",     label: "Amount Collected" },
      { key: "balance_outstanding",  label: "Balance Outstanding" },
    ],
  },

  materials_cost: {
    label: "Materials & Cost Report",
    description: "Itemized list of every material purchased across selected jobs",
    icon: "🧱",
    columns: [
      { key: "job_name",        label: "Job Name" },
      { key: "job_number",      label: "Job #" },
      { key: "date_purchased",  label: "Date" },
      { key: "material_name",   label: "Material" },
      { key: "brand",           label: "Brand" },
      { key: "spec",            label: "Color / Spec" },
      { key: "category",        label: "Category" },
      { key: "quantity",        label: "Qty Ordered" },
      { key: "unit",            label: "Unit" },
      { key: "unit_cost",       label: "Unit Cost" },
      { key: "total_cost",      label: "Total Cost" },
      { key: "vendor",          label: "Vendor / Supplier" },
      { key: "receipt_attached",label: "Receipt" },
    ],
  },

  labor: {
    label: "Labor Report",
    description: "All labor logged by crew member — useful for payroll and job costing",
    icon: "👷",
    columns: [
      { key: "job_name",    label: "Job Name" },
      { key: "job_number",  label: "Job #" },
      { key: "work_date",   label: "Date" },
      { key: "crew_member", label: "Crew Member" },
      { key: "trade",       label: "Trade" },
      { key: "hours",       label: "Hours" },
      { key: "hourly_rate", label: "Rate ($/hr)" },
      { key: "total_cost",  label: "Total Cost" },
      { key: "notes",       label: "Notes" },
    ],
  },

  tax_summary: {
    label: "Tax Summary Report",
    description: "Schedule C ready — total revenue, expenses, mileage, and net profit",
    icon: "🧾",
    columns: [
      { key: "schedule_c_line", label: "Schedule C" },
      { key: "description",     label: "Description" },
      { key: "amount",          label: "Amount" },
    ],
  },

  invoices_payments: {
    label: "Invoice & Payments Report",
    description: "Complete accounts receivable — invoiced, collected, outstanding",
    icon: "💳",
    columns: [
      { key: "invoice_number",      label: "Invoice #" },
      { key: "job_name",            label: "Job Name" },
      { key: "client_name",         label: "Client" },
      { key: "invoice_date",        label: "Invoice Date" },
      { key: "due_date",            label: "Due Date" },
      { key: "amount_invoiced",     label: "Amount Invoiced" },
      { key: "amount_paid",         label: "Amount Paid" },
      { key: "payment_date",        label: "Payment Date" },
      { key: "balance_outstanding", label: "Balance" },
      { key: "days_outstanding",    label: "Days Out" },
      { key: "invoice_status",      label: "Status" },
    ],
  },

  mileage: {
    label: "Mileage & Vehicle Report",
    description: "IRS-ready mileage log — meets substantiation requirements",
    icon: "🚛",
    columns: [
      { key: "log_date",   label: "Date" },
      { key: "job_name",   label: "Job" },
      { key: "purpose",    label: "Purpose" },
      { key: "miles",      label: "Miles" },
      { key: "irs_rate",   label: "IRS Rate" },
      { key: "deduction",  label: "Deduction" },
    ],
  },

  waste_variance: {
    label: "Material Waste & Variance Report",
    description: "Baseline vs. actual — find where you consistently over-order",
    icon: "📉",
    columns: [
      { key: "job_name",      label: "Job Name" },
      { key: "material_name", label: "Material" },
      { key: "baseline_qty",  label: "Baseline Qty" },
      { key: "actual_qty",    label: "Actual Qty" },
      { key: "qty_variance",  label: "Qty Variance" },
      { key: "baseline_cost", label: "Baseline Cost" },
      { key: "actual_cost",   label: "Actual Cost" },
      { key: "cost_variance", label: "Cost Variance" },
      { key: "disposition",   label: "Disposition" },
    ],
  },

  custom: {
    label: "Custom Report",
    description: "Choose which report sections to include and export together",
    icon: "⚙️",
    columns: [],
  },
};

// ── Custom report: which sections can be combined ─────────────────────────────

export const CUSTOM_SECTION_OPTIONS: { type: ReportType; label: string }[] = [
  { type: "job_profitability",  label: "Job Profitability" },
  { type: "materials_cost",     label: "Materials & Cost" },
  { type: "labor",              label: "Labor" },
  { type: "invoices_payments",  label: "Invoices & Payments" },
  { type: "mileage",            label: "Mileage" },
  { type: "waste_variance",     label: "Waste & Variance" },
];

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  this_week:    "This Week",
  last_week:    "Last Week",
  this_month:   "This Month",
  last_month:   "Last Month",
  this_quarter: "This Quarter",
  last_quarter: "Last Quarter",
  this_year:    "This Year",
  last_year:    "Last Year",
  all_time:     "All Time",
  custom:       "Custom Range",
};

export const JOB_TYPES = [
  "Drywall", "Framing", "Plumbing", "Paint", "Trim",
  "Roofing", "Tile", "Flooring", "Electrical", "HVAC",
  "Concrete", "Landscaping",
];

// ── Date resolver ─────────────────────────────────────────────────────────────

export function resolveDateRange(
  preset: DatePreset,
  customStart?: string,
  customEnd?: string
): { start: string; end: string } {
  const now = new Date();
  const y   = now.getFullYear();
  const m   = now.getMonth();
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const today = fmt(now);

  switch (preset) {
    case "this_week": {
      const dow  = now.getDay();
      const back = dow === 0 ? 6 : dow - 1;
      return { start: fmt(new Date(y, m, now.getDate() - back)), end: today };
    }
    case "last_week": {
      const dow  = now.getDay();
      const back = dow === 0 ? 6 : dow - 1;
      const monThis = new Date(y, m, now.getDate() - back);
      const monLast = new Date(monThis.getTime() - 7 * 86400000);
      const sunLast = new Date(monThis.getTime() - 86400000);
      return { start: fmt(monLast), end: fmt(sunLast) };
    }
    case "this_month":
      return { start: fmt(new Date(y, m, 1)), end: today };
    case "last_month":
      return { start: fmt(new Date(y, m - 1, 1)), end: fmt(new Date(y, m, 0)) };
    case "this_quarter": {
      const q = Math.floor(m / 3);
      return { start: fmt(new Date(y, q * 3, 1)), end: today };
    }
    case "last_quarter": {
      const q = Math.floor(m / 3);
      if (q === 0) return { start: fmt(new Date(y - 1, 9, 1)), end: fmt(new Date(y, 0, 0)) };
      return { start: fmt(new Date(y, (q - 1) * 3, 1)), end: fmt(new Date(y, q * 3, 0)) };
    }
    case "this_year":
      return { start: fmt(new Date(y, 0, 1)), end: today };
    case "last_year":
      return { start: fmt(new Date(y - 1, 0, 1)), end: fmt(new Date(y - 1, 11, 31)) };
    case "all_time":
      return { start: "2020-01-01", end: today };
    case "custom":
      return {
        start: customStart ?? fmt(new Date(y, m, 1)),
        end:   customEnd   ?? today,
      };
  }
}

// ── Formatting helpers (client-safe) ─────────────────────────────────────────

export function fmtDateLong(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function fmtMoneyExact(n: number | null | undefined): string {
  if (n == null) return "—";
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `($${formatted})` : `$${formatted}`;
}
