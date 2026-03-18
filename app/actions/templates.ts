"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface TemplateMaterial {
  name: string;
  unit: string;
  category: string;
}

export interface JobTemplate {
  id: string;
  user_id: string;
  name: string;
  job_types: string[];
  materials: TemplateMaterial[];
  labor_categories: string[];
  punch_list_items: string[];
  notes: string | null;
  created_at: string;
}

// ─── Starter templates ───────────────────────────────────────────────────────

const STARTER_TEMPLATES: Omit<JobTemplate, "id" | "user_id" | "created_at">[] = [
  {
    name: "Fire & Flood Restoration",
    job_types: ["drywall", "paint"],
    materials: [
      { name: "Demo debris bags", unit: "bag", category: "materials" },
      { name: "Plastic sheeting", unit: "roll", category: "materials" },
      { name: "Moisture barrier", unit: "roll", category: "materials" },
      { name: "Anti-microbial primer", unit: "gal", category: "materials" },
      { name: "Mold remediation spray", unit: "gal", category: "materials" },
      { name: "Drywall 1/2\"", unit: "sheet", category: "materials" },
      { name: "Joint compound", unit: "bucket", category: "materials" },
      { name: "Paint", unit: "gal", category: "materials" },
    ],
    labor_categories: ["Demo & Haul-out", "Remediation", "Drywall Install", "Paint"],
    punch_list_items: [
      "Moisture readings taken",
      "Demo complete",
      "Antimicrobial applied",
      "Drywall installed",
      "Painted",
      "Final walkthrough",
    ],
    notes: null,
  },
  {
    name: "Bathroom Remodel",
    job_types: ["tile", "plumbing", "drywall"],
    materials: [
      { name: "Cement board", unit: "sheet", category: "materials" },
      { name: "Thinset", unit: "bag", category: "materials" },
      { name: "Tile", unit: "sq ft", category: "materials" },
      { name: "Grout", unit: "bag", category: "materials" },
      { name: "Grout sealer", unit: "bottle", category: "materials" },
      { name: "Drywall moisture resistant", unit: "sheet", category: "materials" },
      { name: "Vanity", unit: "ea", category: "materials" },
      { name: "Toilet", unit: "ea", category: "materials" },
      { name: "Supply lines", unit: "ea", category: "materials" },
      { name: "Wax ring", unit: "ea", category: "materials" },
    ],
    labor_categories: ["Demo", "Plumbing Rough-in", "Tile Work", "Fixture Install"],
    punch_list_items: [
      "Demo complete",
      "Plumbing roughed in",
      "Cement board installed",
      "Tile set",
      "Grout sealed",
      "Fixtures installed",
      "Final inspection",
    ],
    notes: null,
  },
  {
    name: "Exterior Repaint",
    job_types: ["paint"],
    materials: [
      { name: "Exterior paint", unit: "gal", category: "materials" },
      { name: "Primer", unit: "gal", category: "materials" },
      { name: "Painters tape", unit: "roll", category: "materials" },
      { name: "Drop cloth", unit: "ea", category: "materials" },
      { name: "Roller covers", unit: "ea", category: "materials" },
      { name: "Brushes", unit: "ea", category: "materials" },
      { name: "Caulk", unit: "tube", category: "materials" },
    ],
    labor_categories: ["Surface Prep", "Prime", "Paint", "Trim & Detail"],
    punch_list_items: [
      "Surface prepped",
      "Primed",
      "First coat",
      "Second coat",
      "Trim complete",
      "Cleanup done",
    ],
    notes: null,
  },
];

// ─── Seed starters for new users ─────────────────────────────────────────────

async function seedStarterTemplates(userId: string) {
  const supabase = createClient();
  const rows = STARTER_TEMPLATES.map((t) => ({ ...t, user_id: userId }));
  await supabase.from("job_templates").insert(rows);
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getTemplates(): Promise<JobTemplate[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("job_templates")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  // Seed starters on first visit
  if (!data || data.length === 0) {
    await seedStarterTemplates(user.id);
    const { data: seeded } = await supabase
      .from("job_templates")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    return (seeded ?? []) as JobTemplate[];
  }

  return (data ?? []) as JobTemplate[];
}

export async function getTemplate(id: string): Promise<JobTemplate | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("job_templates")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  return data as JobTemplate | null;
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createTemplate(payload: {
  name: string;
  job_types: string[];
  materials: TemplateMaterial[];
  labor_categories: string[];
  punch_list_items: string[];
  notes?: string | null;
}): Promise<{ template?: JobTemplate; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!payload.name.trim()) return { error: "Template name is required." };

  const { data, error } = await supabase
    .from("job_templates")
    .insert({ ...payload, user_id: user.id })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/templates");
  return { template: data as JobTemplate };
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateTemplate(
  id: string,
  payload: {
    name: string;
    job_types: string[];
    materials: TemplateMaterial[];
    labor_categories: string[];
    punch_list_items: string[];
    notes?: string | null;
  }
): Promise<{ template?: JobTemplate; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!payload.name.trim()) return { error: "Template name is required." };

  const { data, error } = await supabase
    .from("job_templates")
    .update(payload)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/templates");
  return { template: data as JobTemplate };
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteTemplate(id: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("job_templates")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/templates");
  return {};
}

// ─── Save job as template ─────────────────────────────────────────────────────

export async function saveJobAsTemplate(
  jobId: string,
  templateName: string
): Promise<{ template?: JobTemplate; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!templateName.trim()) return { error: "Template name is required." };

  const [{ data: job }, { data: materials }, { data: punchItems }] = await Promise.all([
    supabase.from("jobs").select("types").eq("id", jobId).eq("user_id", user.id).single(),
    supabase.from("materials").select("name, unit, category").eq("job_id", jobId),
    supabase.from("punch_list_items").select("description").eq("job_id", jobId),
  ]);

  if (!job) return { error: "Job not found." };

  const payload = {
    user_id: user.id,
    name: templateName.trim(),
    job_types: job.types ?? [],
    materials: (materials ?? []).map((m) => ({
      name: m.name,
      unit: m.unit,
      category: m.category,
    })),
    labor_categories: [] as string[],
    punch_list_items: (punchItems ?? []).map((p) => p.description),
    notes: null,
  };

  const { data, error } = await supabase
    .from("job_templates")
    .insert(payload)
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/templates");
  return { template: data as JobTemplate };
}

// ─── Apply template to job ────────────────────────────────────────────────────

export async function applyTemplateToJob(
  jobId: string,
  templateId: string
): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: template } = await supabase
    .from("job_templates")
    .select("*")
    .eq("id", templateId)
    .eq("user_id", user.id)
    .single();

  if (!template) return { error: "Template not found." };

  const tmpl = template as JobTemplate;

  // Insert materials (qty=1, no cost — user fills those in)
  if (tmpl.materials.length > 0) {
    const matRows = tmpl.materials.map((m) => ({
      job_id: jobId,
      user_id: user.id,
      name: m.name,
      unit: m.unit || "ea",
      quantity_ordered: 1,
      category: m.category || "materials",
    }));
    await supabase.from("materials").insert(matRows);
  }

  // Insert punch list items
  if (tmpl.punch_list_items.length > 0) {
    const punchRows = tmpl.punch_list_items
      .filter((d) => d.trim())
      .map((description) => ({
        job_id: jobId,
        user_id: user.id,
        description,
        completed: false,
      }));
    await supabase.from("punch_list_items").insert(punchRows);
  }

  return {};
}
