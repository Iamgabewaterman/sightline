"use server";

import { createClient } from "@/lib/supabase/server";
import { JobType, JobStatus, ExpenseCategory } from "@/types";
import { detectCategoryFromVendor } from "@/lib/expense-category";

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

// ── Normalizers ──────────────────────────────────────────────────────────────

const JOB_TYPE_MAP: Record<string, JobType> = {
  drywall: "drywall", framing: "framing", plumbing: "plumbing",
  paint: "paint", painting: "paint", trim: "trim", roofing: "roofing",
  tile: "tile", flooring: "flooring", electrical: "electrical",
  electric: "electrical", hvac: "hvac", concrete: "concrete",
  landscaping: "landscaping", landscape: "landscaping",
};

const JOB_STATUS_MAP: Record<string, JobStatus> = {
  active: "active", "in progress": "active", "in_progress": "active", open: "active",
  on_hold: "on_hold", "on hold": "on_hold", paused: "on_hold", hold: "on_hold",
  completed: "completed", done: "completed", finished: "completed", closed: "completed",
};

const CATEGORY_MAP: Record<string, ExpenseCategory> = {
  materials: "materials", material: "materials", supplies: "materials", supply: "materials",
  labor: "labor", wages: "labor", payroll: "labor",
  equipment: "equipment", tools: "equipment", rental: "equipment",
  vehicle: "vehicle", mileage: "vehicle", gas: "vehicle", fuel: "vehicle", auto: "vehicle",
  subcontractor: "subcontractor", sub: "subcontractor", subcontract: "subcontractor",
  permits: "permits", permit: "permits", license: "permits",
  insurance: "insurance", insur: "insurance",
  other: "other",
};

function parseTypes(raw: string): JobType[] {
  if (!raw) return [];
  return raw.split(/[,;|]/).map((s) => {
    const key = s.trim().toLowerCase();
    return JOB_TYPE_MAP[key];
  }).filter(Boolean) as JobType[];
}

function parseStatus(raw: string): JobStatus {
  return JOB_STATUS_MAP[raw.trim().toLowerCase()] ?? "active";
}

function parseCategory(raw: string): ExpenseCategory {
  return CATEGORY_MAP[raw.trim().toLowerCase()] ?? "other";
}

function parseAmount(raw: string): number | null {
  const n = parseFloat(raw.replace(/[$,\s]/g, ""));
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

// ── Client Import ─────────────────────────────────────────────────────────────

export interface ClientRow {
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

export async function importClients(rows: ClientRow[]): Promise<ImportResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { imported: 0, skipped: 0, errors: ["Not authenticated"] };

  // Fetch existing clients for duplicate detection
  const { data: existing } = await supabase
    .from("clients")
    .select("name, phone")
    .eq("user_id", user.id);

  const existingKeys = new Set(
    (existing ?? []).map((c) => `${c.name.toLowerCase()}|${(c.phone ?? "").toLowerCase()}`)
  );

  let imported = 0, skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.name?.trim()) {
      errors.push(`Row ${i + 1}: Name is required`);
      continue;
    }

    const key = `${row.name.trim().toLowerCase()}|${(row.phone ?? "").trim().toLowerCase()}`;
    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }

    const { error } = await supabase.from("clients").insert({
      user_id: user.id,
      name: row.name.trim(),
      company: row.company?.trim() || null,
      phone: row.phone?.trim() || null,
      email: row.email?.trim() || null,
      address: row.address?.trim() || null,
      notes: row.notes?.trim() || null,
    });

    if (error) {
      errors.push(`Row ${i + 1}: ${error.message}`);
    } else {
      imported++;
      existingKeys.add(key);
    }
  }

  return { imported, skipped, errors };
}

// ── Job Import ────────────────────────────────────────────────────────────────

export interface JobRow {
  name: string;
  types?: string;
  address?: string;
  status?: string;
  notes?: string;
  client_name?: string;
}

export async function importJobs(rows: JobRow[]): Promise<ImportResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { imported: 0, skipped: 0, errors: ["Not authenticated"] };

  // Fetch existing jobs for duplicate detection
  const { data: existing } = await supabase
    .from("jobs").select("name").eq("user_id", user.id);
  const existingNames = new Set((existing ?? []).map((j) => j.name.toLowerCase()));

  // Fetch existing clients for name matching
  const { data: clients } = await supabase
    .from("clients").select("id, name").eq("user_id", user.id);
  const clientMap = new Map((clients ?? []).map((c) => [c.name.toLowerCase(), c.id]));

  let imported = 0, skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.name?.trim()) {
      errors.push(`Row ${i + 1}: Job name is required`);
      continue;
    }

    if (existingNames.has(row.name.trim().toLowerCase())) {
      skipped++;
      continue;
    }

    const types = parseTypes(row.types ?? "");
    const status = parseStatus(row.status ?? "active");
    const clientId = row.client_name
      ? (clientMap.get(row.client_name.trim().toLowerCase()) ?? null)
      : null;

    const { error } = await supabase.from("jobs").insert({
      user_id: user.id,
      name: row.name.trim(),
      types: types.length > 0 ? types : [],
      address: row.address?.trim() || "",
      status,
      notes: row.notes?.trim() || null,
      client_id: clientId,
      total_paused_days: 0,
    });

    if (error) {
      errors.push(`Row ${i + 1}: ${error.message}`);
    } else {
      imported++;
      existingNames.add(row.name.trim().toLowerCase());
    }
  }

  return { imported, skipped, errors };
}

// ── Expense Import ────────────────────────────────────────────────────────────

export interface ExpenseRow {
  description: string;
  amount?: string;
  date?: string;
  category?: string;
  job_name?: string;
}

export async function importExpenses(rows: ExpenseRow[]): Promise<ImportResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { imported: 0, skipped: 0, errors: ["Not authenticated"] };

  // Fetch jobs for name matching
  const { data: jobs } = await supabase
    .from("jobs").select("id, name").eq("user_id", user.id);
  const jobMap = new Map((jobs ?? []).map((j) => [j.name.toLowerCase(), j.id]));

  let imported = 0, skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.description?.trim()) {
      errors.push(`Row ${i + 1}: Description is required`);
      continue;
    }

    const amount = row.amount ? parseAmount(row.amount) : null;
    const category = row.category
      ? parseCategory(row.category)
      : detectCategoryFromVendor(row.description);

    const jobId = row.job_name
      ? (jobMap.get(row.job_name.trim().toLowerCase()) ?? null)
      : null;

    // If no job found, we'll still import but won't link
    const insertJobId = jobId ?? (jobs?.[0]?.id ?? null);
    if (!insertJobId) {
      errors.push(`Row ${i + 1}: No jobs exist to link this expense to — import jobs first`);
      continue;
    }

    const receiptDate = row.date ? new Date(row.date) : new Date();
    const createdAt = isNaN(receiptDate.getTime()) ? new Date().toISOString() : receiptDate.toISOString();

    const { error } = await supabase.from("receipts").insert({
      job_id: insertJobId,
      user_id: user.id,
      storage_path: `imports/placeholder-${Date.now()}-${i}`,
      vendor: row.description.trim(),
      amount,
      ocr_raw: null,
      category,
      created_at: createdAt,
    });

    if (error) {
      errors.push(`Row ${i + 1}: ${error.message}`);
    } else {
      imported++;
    }
  }

  return { imported, skipped, errors };
}
