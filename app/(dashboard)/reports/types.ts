// Shared types and config for the report builder — no server/client directives.

export type ReportType =
  | "job_summary"
  | "materials"
  | "labor"
  | "profitability"
  | "invoices_payments"
  | "mileage_tax"
  | "full_business";

export type DatePreset =
  | "this_week"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "last_quarter"
  | "this_year"
  | "custom";

export type JobFilterType = "all" | "type" | "status" | "specific";
export type ExportFormat = "csv" | "pdf" | "both";

export interface ReportConfig {
  reportType: ReportType;
  datePreset: DatePreset;
  dateStart?: string;
  dateEnd?: string;
  jobFilterType: JobFilterType;
  jobFilterValues: string[];
  columns: string[];
  exportFormat: ExportFormat;
}

export interface ReportSection {
  title: string;
  type: Exclude<ReportType, "full_business">;
  rows: Record<string, unknown>[];
}

export interface ReportResult {
  rows: Record<string, unknown>[];
  sections?: ReportSection[];
  error?: string;
}

export interface ReportTemplate {
  id: string;
  user_id: string;
  name: string;
  config: ReportConfig;
  created_at: string;
}

// ── Column definitions per report type ──────────────────────────────────────

export interface ColumnDef {
  key: string;
  label: string;
}

export const REPORT_TYPE_CONFIG: Record<
  ReportType,
  { label: string; columns: ColumnDef[] }
> = {
  job_summary: {
    label: "Job Summary Report",
    columns: [
      { key: "job_name",        label: "Job Name" },
      { key: "job_number",      label: "Job #" },
      { key: "types",           label: "Type(s)" },
      { key: "status",          label: "Status" },
      { key: "address",         label: "Address" },
      { key: "client",          label: "Client" },
      { key: "start_date",      label: "Start Date" },
      { key: "completed_date",  label: "End Date" },
      { key: "total_days",      label: "Days" },
      { key: "calculated_sqft", label: "Sq Ft" },
    ],
  },
  materials: {
    label: "Materials Report",
    columns: [
      { key: "job_name",         label: "Job Name" },
      { key: "job_number",       label: "Job #" },
      { key: "name",             label: "Material" },
      { key: "category",         label: "Category" },
      { key: "trade",            label: "Trade" },
      { key: "quantity_ordered", label: "Qty Ordered" },
      { key: "quantity_used",    label: "Qty Used" },
      { key: "unit",             label: "Unit" },
      { key: "unit_cost",        label: "Unit Cost" },
      { key: "total_cost",       label: "Total Cost" },
      { key: "created_at",       label: "Date Added" },
      { key: "notes",            label: "Notes" },
    ],
  },
  labor: {
    label: "Labor Report",
    columns: [
      { key: "job_name",   label: "Job Name" },
      { key: "job_number", label: "Job #" },
      { key: "crew_name",  label: "Crew Member" },
      { key: "trade",      label: "Trade" },
      { key: "category",   label: "Category" },
      { key: "hours",      label: "Hours" },
      { key: "rate",       label: "Rate ($/hr)" },
      { key: "total_cost", label: "Total Cost" },
      { key: "created_at", label: "Date" },
    ],
  },
  profitability: {
    label: "Profitability Report",
    columns: [
      { key: "job_name",         label: "Job Name" },
      { key: "job_number",       label: "Job #" },
      { key: "status",           label: "Status" },
      { key: "quote_amount",     label: "Quote" },
      { key: "material_budget",  label: "Mat. Budget" },
      { key: "labor_budget",     label: "Lab. Budget" },
      { key: "actual_materials", label: "Actual Mat." },
      { key: "actual_labor",     label: "Actual Lab." },
      { key: "total_actual",     label: "Total Cost" },
      { key: "profit",           label: "Profit" },
      { key: "margin_pct",       label: "Margin %" },
    ],
  },
  invoices_payments: {
    label: "Invoice & Payments Report",
    columns: [
      { key: "job_name",       label: "Job Name" },
      { key: "job_number",     label: "Job #" },
      { key: "invoice_number", label: "Invoice #" },
      { key: "status",         label: "Status" },
      { key: "client",         label: "Client" },
      { key: "total_amount",   label: "Amount" },
      { key: "payment_terms",  label: "Terms" },
      { key: "sent_at",        label: "Sent" },
      { key: "paid_at",        label: "Paid" },
      { key: "due_date",       label: "Due Date" },
    ],
  },
  mileage_tax: {
    label: "Mileage & Tax Report",
    columns: [
      { key: "log_date",    label: "Date" },
      { key: "job_name",    label: "Job" },
      { key: "description", label: "Description" },
      { key: "miles",       label: "Miles" },
      { key: "rate",        label: "Rate ($/mi)" },
      { key: "deduction",   label: "Deduction" },
    ],
  },
  full_business: {
    label: "Full Business Report",
    columns: [],
  },
};

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  this_week:    "This Week",
  this_month:   "This Month",
  last_month:   "Last Month",
  this_quarter: "This Quarter",
  last_quarter: "Last Quarter",
  this_year:    "This Year",
  custom:       "Custom Range",
};

export const JOB_TYPES = [
  "Drywall", "Framing", "Plumbing", "Paint", "Trim",
  "Roofing", "Tile", "Flooring", "Electrical", "HVAC",
  "Concrete", "Landscaping",
];

export const FULL_BUSINESS_SECTION_TYPES: Record<string, Exclude<ReportType, "full_business">> = {
  "Job Summary":          "job_summary",
  "Materials":            "materials",
  "Labor":                "labor",
  "Profitability":        "profitability",
  "Invoices & Payments":  "invoices_payments",
  "Mileage & Tax":        "mileage_tax",
};

// ── Shared pure utility — safe to import on client or server ─────────────────

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
    case "custom":
      return {
        start: customStart ?? fmt(new Date(y, m, 1)),
        end:   customEnd   ?? today,
      };
  }
}
