"use server";

import { createClient } from "@/lib/supabase/server";
import { detectCategoryFromVendor } from "@/lib/expense-category";
import { MegaImportType } from "@/lib/detect-file-type";
import { normalizeCurrency, normalizeDate, normalizePhone } from "@/lib/normalize-import";
import { JobType, JobStatus, ExpenseCategory } from "@/types";

export interface MegaImportFilePreview {
  fileName: string;
  detectedType: MegaImportType;
  platform: string;
  rowCount: number;
  headers: string[];
  sampleRows: Record<string, string>[];
}

export interface MegaImportSummary {
  clients:   { imported: number; skipped: number };
  jobs:      { imported: number; skipped: number };
  materials: { imported: number; skipped: number };
  labor:     { imported: number; skipped: number };
  expenses:  { imported: number; skipped: number };
  contacts:  { imported: number; skipped: number };
  needsReview: { fileName: string; reason: string }[];
  errors: string[];
}

// ── Normalizers ───────────────────────────────────────────────────────────────

const JOB_TYPE_MAP: Record<string, JobType> = {
  drywall: "drywall", framing: "framing", plumbing: "plumbing",
  paint: "paint", painting: "paint", trim: "trim", roofing: "roofing",
  tile: "tile", tiling: "tile", flooring: "flooring", hardwood: "flooring",
  electrical: "electrical", electric: "electrical", hvac: "hvac",
  "heating & cooling": "hvac", concrete: "concrete", flatwork: "concrete",
  landscaping: "landscaping", landscape: "landscaping",
  deck: "decks_patios", decks: "decks_patios", patio: "decks_patios",
  fence: "fencing", fencing: "fencing",
};

const JOB_STATUS_MAP: Record<string, JobStatus> = {
  active: "active", "in progress": "active", in_progress: "active", open: "active",
  scheduled: "active", pending: "active", started: "active",
  on_hold: "on_hold", "on hold": "on_hold", paused: "on_hold", hold: "on_hold", waiting: "on_hold",
  completed: "completed", done: "completed", finished: "completed", closed: "completed",
  // Jobber
  "work requested": "active", "awaiting response": "on_hold",
  // Leap / JobNimbus
  sold: "active", won: "active", "install scheduled": "active", installed: "completed",
  // AccuLynx
  approved: "active", "in production": "active", invoiced: "completed",
  // ServiceTitan
  dispatched: "active", complete: "completed",
};

const CATEGORY_MAP: Record<string, ExpenseCategory> = {
  materials: "materials", material: "materials", supplies: "materials", "job materials": "materials",
  labor: "labor", wages: "labor", payroll: "labor", "direct labor": "labor",
  equipment: "equipment", tools: "equipment", rental: "equipment", "tool rental": "equipment",
  vehicle: "vehicle", mileage: "vehicle", gas: "vehicle", fuel: "vehicle", auto: "vehicle",
  subcontractor: "subcontractor", sub: "subcontractor", "outside services": "subcontractor",
  permits: "permits", permit: "permits", license: "permits", fees: "permits",
  insurance: "insurance", "workers comp": "insurance", "general liability": "insurance",
  other: "other",
};

function parseTypes(raw: string): JobType[] {
  if (!raw) return [];
  return raw.split(/[,;|]/).map((s) => JOB_TYPE_MAP[s.trim().toLowerCase()]).filter(Boolean) as JobType[];
}

function parseStatus(raw: string): JobStatus {
  return JOB_STATUS_MAP[raw.trim().toLowerCase()] ?? "active";
}

function parseCategory(raw: string): ExpenseCategory {
  return CATEGORY_MAP[raw.trim().toLowerCase()] ?? "other";
}

function parseBool(raw: string): boolean {
  return ["yes", "true", "1", "x", "checked"].includes(raw.trim().toLowerCase());
}

// pick() — tries multiple column name variants (snake_case, space, camelCase, no-separator)
function pick(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const variants = [
      k,
      k.replace(/_/g, " "),
      k.replace(/_/g, ""),
      k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), // camelCase
      k.replace(/\s+/g, "_"),
      k.replace(/\s+/g, ""),
    ];
    for (const v of variants) {
      const val = row[v] ?? row[v.toLowerCase()] ?? "";
      if (typeof val === "string" && val.trim()) return val.trim();
    }
  }
  return "";
}

// ── Mega Import ───────────────────────────────────────────────────────────────

export interface MegaFileInput {
  fileName: string;
  detectedType: MegaImportType;
  platform?: string;
  rows: Record<string, string>[];
}

export async function runMegaImport(files: MegaFileInput[]): Promise<MegaImportSummary> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      clients: { imported: 0, skipped: 0 }, jobs: { imported: 0, skipped: 0 },
      materials: { imported: 0, skipped: 0 }, labor: { imported: 0, skipped: 0 },
      expenses: { imported: 0, skipped: 0 }, contacts: { imported: 0, skipped: 0 },
      needsReview: [], errors: ["Not authenticated"],
    };
  }

  const summary: MegaImportSummary = {
    clients:   { imported: 0, skipped: 0 },
    jobs:      { imported: 0, skipped: 0 },
    materials: { imported: 0, skipped: 0 },
    labor:     { imported: 0, skipped: 0 },
    expenses:  { imported: 0, skipped: 0 },
    contacts:  { imported: 0, skipped: 0 },
    needsReview: [],
    errors: [],
  };

  // Group files by type — process in dependency order
  const byType: Record<MegaImportType, MegaFileInput[]> = {
    clients: [], jobs: [], materials: [], labor: [], expenses: [], contacts: [], unknown: [],
  };
  for (const f of files) byType[f.detectedType].push(f);

  // Mark unknowns for review
  for (const f of byType.unknown) {
    summary.needsReview.push({ fileName: f.fileName, reason: "Could not detect file type from column headers" });
  }

  // ── 1. Clients ──────────────────────────────────────────────────────────────
  const { data: existingClients } = await supabase
    .from("clients").select("id, name, phone").eq("user_id", user.id);
  const clientKeys = new Set((existingClients ?? []).map((c) =>
    `${c.name.toLowerCase()}|${(c.phone ?? "").toLowerCase()}`
  ));
  const clientMap = new Map((existingClients ?? []).map((c) => [c.name.toLowerCase(), c.id]));

  for (const file of byType.clients) {
    for (const row of file.rows) {
      const name = pick(
        row,
        "name", "client_name", "full_name", "contact_name",
        // QuickBooks
        "customer", "customer_name",
        // Jobber
        "client name", "billing_contact",
        // Leap / Buildertrend
        "homeowner", "property_owner", "lead_name",
        // ServiceTitan
        "account_name",
      );
      if (!name) continue;

      const rawPhone = pick(row, "phone", "phone_number", "mobile", "cell", "telephone");
      const phone = normalizePhone(rawPhone);
      const key = `${name.toLowerCase()}|${phone.toLowerCase()}`;
      if (clientKeys.has(key)) { summary.clients.skipped++; continue; }

      const { data: inserted, error } = await supabase.from("clients").insert({
        user_id: user.id,
        name,
        company: pick(row, "company", "company_name", "business", "business_name") || null,
        phone: phone || null,
        email: pick(row, "email", "email_address", "e_mail") || null,
        address: pick(
          row,
          "address", "street", "location", "billing_address",
          "shipping_address", "property_address", "site_address",
        ) || null,
        notes: pick(row, "notes", "note", "comments", "memo") || null,
      }).select("id, name").single();

      if (error) {
        summary.errors.push(`${file.fileName} — ${name}: ${error.message}`);
      } else {
        summary.clients.imported++;
        clientKeys.add(key);
        if (inserted) clientMap.set(inserted.name.toLowerCase(), inserted.id);
      }
    }
  }

  // ── 2. Jobs ─────────────────────────────────────────────────────────────────
  const { data: existingJobs } = await supabase
    .from("jobs").select("id, name").eq("user_id", user.id);
  const jobNames = new Set((existingJobs ?? []).map((j) => j.name.toLowerCase()));
  const jobMap = new Map((existingJobs ?? []).map((j) => [j.name.toLowerCase(), j.id]));

  for (const file of byType.jobs) {
    for (const row of file.rows) {
      const name = pick(
        row,
        "name", "job_name", "project", "project_name", "job",
        // QuickBooks
        "class", "memo",
        // Jobber
        "job_title", "job title",
        // Leap
        "opportunity",
        // JobNimbus
        "primary_contact", "title",
        // AccuLynx
        "work_order", "work order",
        // Buildertrend
        "project_name",
        // Houzz
        "houzz_project_id",
      );
      if (!name) continue;
      if (jobNames.has(name.toLowerCase())) { summary.jobs.skipped++; continue; }

      const clientName = pick(
        row,
        "client_name", "client", "customer",
        // Jobber
        "client_name", "billing_contact",
        // Leap
        "homeowner", "property_owner",
        // ServiceTitan
        "customer",
      );
      const clientId = clientName ? (clientMap.get(clientName.toLowerCase()) ?? null) : null;

      // Job number — platform-specific variants
      const jobNumRaw = pick(
        row,
        "job_number", "job_num", "invoice_number", "job_id", "number", "ref", "reference",
        // Jobber
        "job number",
        // Leap / AccuLynx
        "claim_number", "work_order_number",
        // JobNimbus
        "job_id",
        // QB
        "num",
      );

      // Insurance claim detection
      const claimRaw = pick(row, "insurance_claim", "is_insurance", "claim", "claim_number", "adjuster");
      const isInsurance = claimRaw ? parseBool(claimRaw) || !!pick(row, "claim_number", "adjuster_name", "adjuster") : false;

      // Notes — append adjuster/claim info if present
      let notesVal = pick(row, "notes", "note", "description", "comments", "memo") || null;
      const adjuster = pick(row, "adjuster", "adjuster_name", "ins_adjuster");
      const claimNum = pick(row, "claim_number", "claim_num");
      if (adjuster || claimNum) {
        const claimInfo = [adjuster && `Adjuster: ${adjuster}`, claimNum && `Claim #: ${claimNum}`].filter(Boolean).join(" | ");
        notesVal = notesVal ? `${notesVal}\n${claimInfo}` : claimInfo;
      }

      const startDateRaw = pick(row, "start_date", "start date", "date_started", "created_date", "date_created", "date");
      const completedDateRaw = pick(row, "completed_date", "completion_date", "date_completed", "close_date", "closed_date");

      const { data: inserted, error } = await supabase.from("jobs").insert({
        user_id: user.id,
        name,
        types: parseTypes(pick(row, "types", "type", "trade", "job_type", "work_type", "scope")),
        address: pick(row, "address", "site", "location", "job_address", "property_address", "site_address") || "",
        status: parseStatus(pick(row, "status", "job_status", "stage", "phase") || "active"),
        notes: notesVal,
        client_id: clientId,
        total_paused_days: 0,
        job_number: jobNumRaw || null,
        insurance_claim: isInsurance,
        start_date: startDateRaw ? normalizeDate(startDateRaw) : null,
        completed_date: completedDateRaw ? normalizeDate(completedDateRaw) : null,
      }).select("id, name").single();

      if (error) {
        summary.errors.push(`${file.fileName} — ${name}: ${error.message}`);
      } else {
        summary.jobs.imported++;
        jobNames.add(name.toLowerCase());
        if (inserted) jobMap.set(inserted.name.toLowerCase(), inserted.id);
      }
    }
  }

  // ── 3. Contacts ─────────────────────────────────────────────────────────────
  const { data: existingContacts } = await supabase
    .from("contacts").select("id, name").eq("user_id", user.id);
  const contactNames = new Set((existingContacts ?? []).map((c) => c.name.toLowerCase()));
  const contactMap = new Map((existingContacts ?? []).map((c) => [c.name.toLowerCase(), c.id]));

  for (const file of byType.contacts) {
    for (const row of file.rows) {
      const name = pick(
        row,
        "name", "full_name", "contact_name", "crew_name", "worker",
        "employee", "technician", "subcontractor_name", "sub_name", "vendor_name",
      );
      if (!name) continue;
      if (contactNames.has(name.toLowerCase())) { summary.contacts.skipped++; continue; }

      const rateRaw = pick(row, "hourly_rate", "rate", "pay_rate", "wage", "billing_rate");
      const rate = normalizeCurrency(rateRaw);
      const subRaw = pick(row, "is_subcontractor", "subcontractor", "sub", "type", "contractor_type");
      const isSub = ["yes", "true", "1", "subcontractor", "sub"].includes(subRaw.toLowerCase());
      const rawPhone = pick(row, "phone", "mobile", "cell", "telephone");

      const { data: inserted, error } = await supabase.from("contacts").insert({
        user_id: user.id,
        name,
        trade: pick(row, "trade", "specialty", "skill", "business_unit", "work_type") || null,
        phone: normalizePhone(rawPhone) || null,
        hourly_rate: rate,
        is_subcontractor: isSub,
        notes: pick(row, "notes", "comments", "license", "certification") || null,
      }).select("id, name").single();

      if (error) {
        summary.errors.push(`${file.fileName} — ${name}: ${error.message}`);
      } else {
        summary.contacts.imported++;
        contactNames.add(name.toLowerCase());
        if (inserted) contactMap.set(inserted.name.toLowerCase(), inserted.id);
      }
    }
  }

  // ── 4. Materials ─────────────────────────────────────────────────────────────
  for (const file of byType.materials) {
    for (const row of file.rows) {
      const name = pick(
        row,
        "name", "material", "item", "description", "material_name",
        // QuickBooks
        "item_name", "item_description", "product",
        // Jobber
        "line_item", "product_service",
        // ServiceTitan
        "part_name", "part_number",
        // Buildertrend
        "material_description",
      );
      const unit = pick(row, "unit", "unit_of_measure", "uom", "unit_type") || "ea";
      const qtyRaw = pick(row, "quantity", "quantity_ordered", "qty", "qty_ordered", "count", "units");
      const qtyOrdered = parseFloat(qtyRaw);
      if (!name || isNaN(qtyOrdered)) continue;

      const jobName = pick(row, "job_name", "job", "project", "project_name", "class");
      const jobId = jobName ? (jobMap.get(jobName.toLowerCase()) ?? null) : null;
      if (!jobId) {
        if (jobName) {
          summary.needsReview.push({ fileName: file.fileName, reason: `Material "${name}" references job "${jobName}" which was not found` });
        } else {
          summary.needsReview.push({ fileName: file.fileName, reason: `Material "${name}" has no job name — cannot import` });
        }
        continue;
      }

      const unitCostRaw = pick(
        row,
        "unit_cost", "cost", "price", "unit_price", "rate",
        // QuickBooks
        "purchase_price", "cost_price",
        // Buildertrend
        "material_cost",
      );
      const unitCost = unitCostRaw ? normalizeCurrency(unitCostRaw) : null;
      const qtyUsedRaw = pick(row, "quantity_used", "qty_used", "used", "qty_installed");
      const qtyUsed = qtyUsedRaw ? parseFloat(qtyUsedRaw) : null;
      const lengthRaw = pick(row, "length_ft", "length", "cut_length", "len");
      const lengthFt = lengthRaw ? parseFloat(lengthRaw) : null;

      const { error } = await supabase.from("materials").insert({
        job_id: jobId,
        name,
        unit,
        quantity_ordered: qtyOrdered,
        quantity_used: isNaN(qtyUsed ?? NaN) ? null : qtyUsed,
        unit_cost: unitCost,
        length_ft: isNaN(lengthFt ?? NaN) ? null : lengthFt,
        trade: pick(row, "trade", "category", "work_type") || null,
        notes: pick(row, "notes", "comments", "memo") || null,
      });

      if (error) {
        summary.errors.push(`${file.fileName} — ${name}: ${error.message}`);
      } else {
        summary.materials.imported++;
      }
    }
  }

  // ── 5. Labor ─────────────────────────────────────────────────────────────────
  const { data: existingLogs } = await supabase
    .from("labor_logs").select("crew_name, job_id, created_at");
  const logKeys = new Set(
    (existingLogs ?? []).map((l) => {
      const d = l.created_at ? (l.created_at as string).slice(0, 10) : "";
      return `${(l.crew_name as string).toLowerCase()}|${l.job_id}|${d}`;
    })
  );

  for (const file of byType.labor) {
    for (const row of file.rows) {
      const crewName = pick(
        row,
        "crew_name", "name", "worker", "employee", "crew",
        // QuickBooks Time
        "employee_name", "source_name",
        // Jobber
        "assigned_to",
        // ServiceTitan
        "technician",
        // Buildertrend
        "crew_member",
      );
      const hoursRaw = pick(
        row,
        "hours", "hours_worked", "hrs",
        // QuickBooks
        "duration", "duration_decimal", "time_hours",
        // Jobber
        "total_duration",
        // ServiceTitan
        "time_spent",
      );
      const hours = parseFloat(hoursRaw);
      const jobName = pick(
        row,
        "job_name", "job", "project", "project_name",
        // QuickBooks
        "class",
        // Jobber
        "job_title",
        // ServiceTitan
        "job",
      );
      if (!crewName || isNaN(hours) || hours <= 0) continue;

      const jobId = jobName ? (jobMap.get(jobName.toLowerCase()) ?? null) : null;
      if (!jobId) {
        if (jobName) summary.needsReview.push({ fileName: file.fileName, reason: `Labor entry for "${crewName}" references job "${jobName}" which was not found` });
        continue;
      }

      const dateRaw = pick(
        row,
        "date", "work_date", "log_date",
        // QuickBooks
        "activity_date", "transaction_date",
        // Jobber
        "visit_date",
        // ServiceTitan
        "dispatch_date", "service_date",
      );
      const dateStr = normalizeDate(dateRaw);

      const logKey = `${crewName.toLowerCase()}|${jobId}|${dateStr}`;
      if (logKeys.has(logKey)) { summary.labor.skipped++; continue; }

      const rateRaw = pick(row, "hourly_rate", "rate", "pay_rate", "billing_rate", "wage");
      const rate = normalizeCurrency(rateRaw) ?? 0;
      const trade = pick(row, "trade", "specialty", "business_unit", "work_type") || null;

      // Auto-create contact if not already tracked
      if (!contactNames.has(crewName.toLowerCase())) {
        const { data: newContact } = await supabase.from("contacts").insert({
          user_id: user.id, name: crewName, trade, hourly_rate: rate > 0 ? rate : null, is_subcontractor: false,
        }).select("id").single();
        if (newContact) {
          contactNames.add(crewName.toLowerCase());
          contactMap.set(crewName.toLowerCase(), newContact.id);
        }
      }

      const { error } = await supabase.from("labor_logs").insert({
        job_id: jobId, crew_name: crewName, hours, rate, trade,
        created_at: new Date(dateStr + "T12:00:00Z").toISOString(),
      });

      if (error) {
        summary.errors.push(`${file.fileName} — ${crewName}: ${error.message}`);
      } else {
        summary.labor.imported++;
        logKeys.add(logKey);
      }
    }
  }

  // ── 6. Expenses ──────────────────────────────────────────────────────────────
  for (const file of byType.expenses) {
    for (const row of file.rows) {
      const description = pick(
        row,
        "description", "vendor", "payee", "item", "expense",
        // QuickBooks
        "memo", "name", "account",
        // ServiceTitan
        "invoice_description",
        // Buildertrend
        "cost_code",
      );
      if (!description) continue;

      const amountRaw = pick(
        row,
        "amount", "total", "cost", "price",
        // QuickBooks
        "debit", "credit",
        // ServiceTitan
        "invoice_amount",
        // Buildertrend
        "actual_cost",
      );
      const amount = amountRaw ? normalizeCurrency(amountRaw) : null;

      const categoryRaw = pick(row, "category", "type", "expense_type", "account", "split");
      const category = categoryRaw ? parseCategory(categoryRaw) : detectCategoryFromVendor(description);

      const jobName = pick(row, "job_name", "job", "project", "class", "job_title");
      const jobId = jobName ? (jobMap.get(jobName.toLowerCase()) ?? null) : null;

      const firstJobId = jobMap.size > 0 ? Array.from(jobMap.values())[0] : null;
      const insertJobId = jobId ?? firstJobId;
      if (!insertJobId) {
        summary.needsReview.push({ fileName: file.fileName, reason: `Expense "${description}" has no matching job — import jobs first` });
        continue;
      }

      const dateRaw = pick(row, "date", "transaction_date", "receipt_date", "invoice_date", "service_date");
      const createdAt = new Date(normalizeDate(dateRaw) + "T12:00:00Z").toISOString();

      const { error } = await supabase.from("receipts").insert({
        job_id: insertJobId,
        user_id: user.id,
        storage_path: `imports/placeholder-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        vendor: description,
        amount,
        category,
        created_at: createdAt,
      });

      if (error) {
        summary.errors.push(`${file.fileName} — ${description}: ${error.message}`);
      } else {
        summary.expenses.imported++;
      }
    }
  }

  return summary;
}
