export type JobType =
  | "drywall"
  | "framing"
  | "plumbing"
  | "paint"
  | "trim"
  | "roofing"
  | "tile"
  | "flooring"
  | "electrical"
  | "hvac"
  | "concrete"
  | "landscaping";

export type JobStatus = "active" | "on_hold" | "completed";

export type PhotoCategory = "before" | "during" | "after" | "receipts" | "damages";

export interface Job {
  id: string;
  user_id: string;
  name: string;
  types: JobType[];
  status: JobStatus;
  address: string;
  notes: string | null;
  lockbox_code: string | null;
  dim_length: number | null;
  dim_width: number | null;
  dim_height: number | null;
  calculated_sqft: number | null;
  client_id: string | null;
  start_date: string | null;
  completed_date: string | null;
  total_days: number | null;
  paused_at: string | null;
  total_paused_days: number;
  created_at: string;
  updated_at: string;
}

export interface DailyLog {
  id: string;
  job_id: string;
  user_id: string;
  log_date: string;
  notes: string | null;
  crew_present: string | null;
  created_at: string;
}

export interface Photo {
  id: string;
  job_id: string;
  category: PhotoCategory;
  storage_path: string;
  created_at: string;
}

export interface Material {
  id: string;
  job_id: string;
  name: string;
  unit: string;
  quantity_ordered: number;
  quantity_used: number | null;
  unit_cost: number | null;
  length_ft: number | null;
  notes: string | null;
  created_at: string;
}

export interface LaborLog {
  id: string;
  job_id: string;
  crew_name: string;
  hours: number;
  rate: number;
  created_at: string;
}

export interface Receipt {
  id: string;
  job_id: string;
  storage_path: string;
  vendor: string | null;
  amount: number | null;
  ocr_raw: string | null;
  created_at: string;
}

export interface ExtractedReceiptItem {
  raw_name: string;
  normalized_name: string;
  qty: number | null;
  unit: string | null;
  unit_price: number | null;
  line_total: number | null;
  checked: boolean;
}

export interface ReceiptExtractionResult {
  receipt_id: string;
  vendor: string | null;
  receipt_date: string | null;
  items: ExtractedReceiptItem[];
  total: number | null;
  image_unclear: boolean;
  auto_confirm: boolean;
}

export interface QuoteAddon {
  name: string;
  description?: string;
  amount: number;
}

export interface SavedLineItem {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  created_at: string;
}

export interface Contact {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  trade: string | null;
  hourly_rate: number | null;
  notes: string | null;
  created_at: string;
}

export interface Crew {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface CrewWithMembers extends Crew {
  crew_members: { contact_id: string }[];
}

export interface ClockSession {
  id: string;
  user_id: string;
  job_id: string;
  clocked_in_at: string;
  clocked_out_at: string | null;
  hours: number | null;
  rate: number | null;
  total: number | null;
  created_at: string;
  // joined
  job_name?: string;
}

export interface BusinessProfile {
  id: string;
  user_id: string;
  business_name: string | null;
  owner_name: string | null;
  license_number: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_path: string | null;
  default_payment_terms: PaymentTerms;
  created_at: string;
}

export interface Client {
  id: string;
  user_id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}

export interface ChangeOrder {
  id: string;
  job_id: string;
  user_id: string;
  description: string;
  amount: number;
  created_at: string;
}

export type InvoiceStatus = "unpaid" | "sent" | "paid";
export type PaymentTerms = "due_on_receipt" | "net_15" | "net_30" | "net_45";

export interface Invoice {
  id: string;
  job_id: string;
  user_id: string;
  client_id: string | null;
  status: InvoiceStatus;
  payment_terms: PaymentTerms;
  due_date: string | null;
  notes: string | null;
  sent_at: string | null;
  paid_at: string | null;
  total_amount: number;
  created_at: string;
}

export interface Estimate {
  id: string;
  job_id: string;
  user_id: string;
  type: string;
  material_total: number;
  labor_total: number;
  profit_margin_pct: number;
  final_quote: number;
  addons: QuoteAddon[];
  created_at: string;
}
