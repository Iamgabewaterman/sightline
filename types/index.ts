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
