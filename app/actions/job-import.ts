"use server";

import { createClient } from "@/lib/supabase/server";
import { Material, LaborLog } from "@/types";

export type RowStatus = "new" | "update" | "duplicate";

// ── Parsed row shapes (from CSV) ──────────────────────────────────────────────

export interface ParsedMaterialRow {
  name: string;
  qty_ordered: number;
  unit_cost: number | null;
  unit: string;
}

export interface ParsedLaborRow {
  crew_name: string;
  hours: number;
  rate: number;
  date: string; // ISO date string e.g. "2026-04-15"
}

// ── Preview row shapes (annotated with dedup status) ─────────────────────────

export interface MaterialPreviewRow {
  parsed: ParsedMaterialRow;
  status: RowStatus;
  existing_id?: string;
}

export interface LaborPreviewRow {
  parsed: ParsedLaborRow;
  status: RowStatus;
  existing_id?: string;
}

export interface JobImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

// ── Preview: materials ────────────────────────────────────────────────────────
// Match key: name (case-insensitive)
// duplicate = same name + same qty + same unit_cost
// update    = same name but different qty or cost
// new       = no name match

export async function previewMaterialsImport(
  jobId: string,
  rows: ParsedMaterialRow[]
): Promise<MaterialPreviewRow[]> {
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("materials")
    .select("id, name, quantity_ordered, unit_cost")
    .eq("job_id", jobId);

  const existingMap = new Map(
    (existing ?? []).map((m) => [m.name.toLowerCase().trim(), m])
  );

  return rows.map((row) => {
    const key = row.name.toLowerCase().trim();
    const match = existingMap.get(key);
    if (!match) return { parsed: row, status: "new" };

    const sameQty = Math.abs(Number(match.quantity_ordered) - row.qty_ordered) < 0.001;
    const sameCost =
      match.unit_cost === null && row.unit_cost === null
        ? true
        : match.unit_cost !== null &&
          row.unit_cost !== null &&
          Math.abs(Number(match.unit_cost) - row.unit_cost) < 0.01;

    if (sameQty && sameCost) {
      return { parsed: row, status: "duplicate", existing_id: match.id };
    }
    return { parsed: row, status: "update", existing_id: match.id };
  });
}

// ── Preview: labor ────────────────────────────────────────────────────────────
// Match key: crew_name (case-insensitive) + date (YYYY-MM-DD prefix of created_at)
// duplicate = same key + same hours
// update    = same key but different hours or rate
// new       = no match

export async function previewLaborImport(
  jobId: string,
  rows: ParsedLaborRow[]
): Promise<LaborPreviewRow[]> {
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("labor_logs")
    .select("id, crew_name, hours, rate, created_at")
    .eq("job_id", jobId);

  // Build map keyed by "crew_name_lower|date"
  const existingMap = new Map(
    (existing ?? []).map((l) => {
      const dateKey = l.created_at ? l.created_at.slice(0, 10) : "";
      return [`${l.crew_name.toLowerCase().trim()}|${dateKey}`, l];
    })
  );

  return rows.map((row) => {
    const key = `${row.crew_name.toLowerCase().trim()}|${row.date}`;
    const match = existingMap.get(key);
    if (!match) return { parsed: row, status: "new" };

    const sameHours = Math.abs(Number(match.hours) - row.hours) < 0.01;
    const sameRate = Math.abs(Number(match.rate) - row.rate) < 0.01;
    if (sameHours && sameRate) {
      return { parsed: row, status: "duplicate", existing_id: match.id };
    }
    return { parsed: row, status: "update", existing_id: match.id };
  });
}

// ── Confirm: materials ────────────────────────────────────────────────────────

export async function confirmMaterialsImport(
  jobId: string,
  rows: MaterialPreviewRow[]
): Promise<JobImportResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { inserted: 0, updated: 0, skipped: 0, errors: ["Not authenticated"] };

  let inserted = 0, updated = 0, skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    if (row.status === "duplicate") {
      skipped++;
      continue;
    }

    if (row.status === "update" && row.existing_id) {
      const { error } = await supabase
        .from("materials")
        .update({
          quantity_ordered: row.parsed.qty_ordered,
          unit_cost: row.parsed.unit_cost,
        })
        .eq("id", row.existing_id);
      if (error) errors.push(`Update "${row.parsed.name}": ${error.message}`);
      else updated++;
      continue;
    }

    // new
    const { error } = await supabase.from("materials").insert({
      job_id: jobId,
      name: row.parsed.name,
      unit: row.parsed.unit || "ea",
      quantity_ordered: row.parsed.qty_ordered,
      quantity_used: null,
      unit_cost: row.parsed.unit_cost,
      length_ft: null,
      notes: null,
      category: "materials",
    });
    if (error) errors.push(`Insert "${row.parsed.name}": ${error.message}`);
    else inserted++;
  }

  return { inserted, updated, skipped, errors };
}

// ── Confirm: labor ────────────────────────────────────────────────────────────

export async function confirmLaborImport(
  jobId: string,
  rows: LaborPreviewRow[]
): Promise<JobImportResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { inserted: 0, updated: 0, skipped: 0, errors: ["Not authenticated"] };

  let inserted = 0, updated = 0, skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    if (row.status === "duplicate") {
      skipped++;
      continue;
    }

    if (row.status === "update" && row.existing_id) {
      const { error } = await supabase
        .from("labor_logs")
        .update({ hours: row.parsed.hours, rate: row.parsed.rate })
        .eq("id", row.existing_id);
      if (error) errors.push(`Update "${row.parsed.crew_name}": ${error.message}`);
      else updated++;
      continue;
    }

    // new — use row.date as created_at so dedup works on re-import
    const { error } = await supabase.from("labor_logs").insert({
      job_id: jobId,
      crew_name: row.parsed.crew_name,
      hours: row.parsed.hours,
      rate: row.parsed.rate,
      created_at: row.parsed.date ? `${row.parsed.date}T00:00:00.000Z` : new Date().toISOString(),
    });
    if (error) errors.push(`Insert "${row.parsed.crew_name}": ${error.message}`);
    else inserted++;
  }

  return { inserted, updated, skipped, errors };
}
