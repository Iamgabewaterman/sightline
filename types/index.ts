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

export type PhotoCategory = "before" | "during" | "after" | "receipts" | "damages";

export interface Job {
  id: string;
  name: string;
  types: JobType[];
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
