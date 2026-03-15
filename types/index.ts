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
  created_at: string;
  updated_at: string;
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

export interface Estimate {
  id: string;
  job_id: string;
  user_id: string;
  type: string;
  material_total: number;
  labor_total: number;
  profit_margin_pct: number;
  final_quote: number;
  created_at: string;
}
