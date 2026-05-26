export interface DemoPhoto {
  id: string;
  label: string;
  category: "before" | "during" | "after";
}

export interface DemoMaterial {
  id: string;
  name: string;
  qty_ordered: number;
  qty_used: number | null;
  unit_cost: number | null;
  unit: string;
}

export interface DemoLabor {
  id: string;
  name: string;
  hours: number;
  rate: number;
  date: string;
}

export interface DemoReceipt {
  id: string;
  vendor: string;
  amount: number;
  category: string;
  date: string;
}

export interface DemoAddon {
  name: string;
  amount: number;
}

export interface DemoQuote {
  material_total: number;
  labor_total: number;
  profit_margin_pct: number;
  final_quote: number;
  addons: DemoAddon[];
  quote_status: "draft" | "sent" | "signed";
  signed_by_name: string | null;
  signed_at: string | null;
}

export interface DemoInvoice {
  number: string;
  status: "unpaid" | "sent" | "paid";
  amount: number;
  sent_at: string | null;
  due_date: string;
  paid_at: string | null;
}

export interface DemoPunchItem {
  id: string;
  description: string;
  completed: boolean;
}

export interface DemoDocument {
  id: string;
  name: string;
  category: string;
  size: string;
  date: string;
  file_type: "application/pdf" | "image/jpeg";
}

export interface DemoClient {
  name: string;
  company: string | null;
  phone: string;
  email: string | null;
}

export interface DemoJob {
  slug: string;
  job_number: string;
  name: string;
  address: string;
  types: string[];
  status: "active" | "on_hold" | "completed";
  notes: string;
  created_at: string;
  start_date: string | null;
  estimated_completion_date: string | null;
  completed_date: string | null;
  lockbox_code: string | null;
  client: DemoClient | null;
  photos: DemoPhoto[];
  materials: DemoMaterial[];
  labor: DemoLabor[];
  receipts: DemoReceipt[];
  documents: DemoDocument[];
  quote: DemoQuote;
  invoice?: DemoInvoice;
  punchList: DemoPunchItem[];
}

// ── Demo contractor ───────────────────────────────────────────────────────────

export const DEMO_CONTRACTOR = {
  name: "Pacific Northwest Contracting",
  license: "CCB-187442",
  owner: "Mike Torrealba",
  phone: "503-555-0192",
  location: "Portland, OR 97201",
};

// ── Jobs ──────────────────────────────────────────────────────────────────────

export const DEMO_JOBS: DemoJob[] = [
  // ── Job 1: Riverside Bathroom Remodel ──────────────────────────────────────
  {
    slug: "riverside-bath",
    job_number: "RBR-2026-001",
    name: "Riverside Bathroom Remodel",
    address: "4821 SW Riverside Drive, Portland, OR 97239",
    types: ["tile", "plumbing"],
    status: "active",
    notes:
      "Full master bath gut and rebuild. Walk-in shower with Daltile Perpetuo 12×24. Schluter waterproofing on all walls. Moen Genta system. Client wants herringbone pattern on floor.",
    created_at: "Apr 10, 2026",
    start_date: "Apr 14, 2026",
    estimated_completion_date: "Jun 6, 2026",
    completed_date: null,
    lockbox_code: "4821",
    client: {
      name: "Sarah & Tom Callahan",
      company: null,
      phone: "(503) 842-9901",
      email: "callahan.portland@gmail.com",
    },
    photos: [
      { id: "p1", label: "Before — original fixtures and floor tile", category: "before" },
      { id: "p2", label: "During — demo complete, cement board going up", category: "during" },
      { id: "p3", label: "During — Schluter waterproofing complete", category: "during" },
    ],
    materials: [
      { id: "m1", name: "Schluter Kerdi Waterproofing Membrane", qty_ordered: 1, qty_used: 1, unit_cost: 94.5, unit: "roll" },
      { id: "m2", name: "Daltile Perpetuo 12×24 Charcoal", qty_ordered: 18, qty_used: 17, unit_cost: 67.2, unit: "box" },
      { id: "m3", name: "Laticrete 254 Platinum Thinset", qty_ordered: 8, qty_used: 6, unit_cost: 28.4, unit: "bag" },
      { id: "m4", name: "Mapei Ultracolor Grout — Charcoal", qty_ordered: 4, qty_used: 2, unit_cost: 19.8, unit: "bag" },
      { id: "m5", name: "Moen Genta Shower System — Brushed Nickel", qty_ordered: 1, qty_used: 1, unit_cost: 387, unit: "unit" },
      { id: "m6", name: "Delta Monitor Shower Valve", qty_ordered: 1, qty_used: 1, unit_cost: 124.5, unit: "unit" },
      { id: "m7", name: '1/2" Cement Board', qty_ordered: 14, qty_used: 14, unit_cost: 18.9, unit: "sheet" },
    ],
    labor: [
      { id: "l1", name: "Mike Torrealba", hours: 20, rate: 85, date: "Apr 14" },
      { id: "l2", name: "Jesse Ramirez — Tile Setter", hours: 12, rate: 72, date: "Apr 18" },
    ],
    receipts: [
      { id: "r1", vendor: "Tile Depot Portland", amount: 1843.2, category: "Materials", date: "Apr 13" },
      { id: "r2", vendor: "Ferguson Plumbing Supply", amount: 511.5, category: "Materials", date: "Apr 14" },
    ],
    documents: [
      { id: "d1", name: "Signed Contract — Callahan.pdf", category: "Contract", size: "312 KB", date: "Apr 10", file_type: "application/pdf" },
    ],
    quote: {
      material_total: 2000,
      labor_total: 1800,
      profit_margin_pct: 22,
      final_quote: 6840,
      addons: [],
      quote_status: "sent",
      signed_by_name: null,
      signed_at: null,
    },
    invoice: {
      number: "INV-2026-047",
      status: "sent",
      amount: 6840,
      sent_at: "May 1, 2026",
      due_date: "May 31, 2026",
      paid_at: null,
    },
    punchList: [
      { id: "pl1", description: "Waterproof shower pan and walls — Schluter Kerdi", completed: true },
      { id: "pl2", description: "Install cement board on all wet areas", completed: true },
      { id: "pl3", description: "Set Daltile Perpetuo on shower walls", completed: false },
      { id: "pl4", description: "Install herringbone floor tile pattern", completed: false },
      { id: "pl5", description: "Grout and seal all surfaces", completed: false },
      { id: "pl6", description: "Install Moen Genta shower system", completed: false },
    ],
  },

  // ── Job 2: Hawthorne Kitchen Renovation ───────────────────────────────────
  {
    slug: "hawthorne-kitchen",
    job_number: "HKR-2026-002",
    name: "Hawthorne Kitchen Renovation",
    address: "2234 SE Hawthorne Blvd, Portland, OR 97214",
    types: ["framing", "flooring"],
    status: "active",
    notes:
      "Full kitchen gut. KraftMaid Maple Dove White cabinets. Silestone Calacatta Gold countertops. Moen Arbor faucet. Client approved cabinet layout May 3 — installation started.",
    created_at: "Apr 30, 2026",
    start_date: "May 5, 2026",
    estimated_completion_date: "Jun 20, 2026",
    completed_date: null,
    lockbox_code: "2234",
    client: {
      name: "David & Priya Mehta",
      company: null,
      phone: "(971) 622-4477",
      email: "mehtafamily.pdx@gmail.com",
    },
    photos: [
      { id: "p1", label: "Before — original kitchen with laminate counters", category: "before" },
      { id: "p2", label: "During — cabinets staged, demo complete", category: "during" },
    ],
    materials: [
      { id: "m1", name: "KraftMaid Maple Dove White — Upper Cabinets", qty_ordered: 8, qty_used: 5, unit_cost: 284, unit: "unit" },
      { id: "m2", name: "KraftMaid Maple Dove White — Lower Cabinets", qty_ordered: 10, qty_used: 4, unit_cost: 312, unit: "unit" },
      { id: "m3", name: "Silestone Calacatta Gold Quartz — 42 sqft", qty_ordered: 42, qty_used: 0, unit_cost: 89, unit: "sqft" },
      { id: "m4", name: "Moen Arbor Pulldown Faucet — Spot Resist Stainless", qty_ordered: 1, qty_used: 0, unit_cost: 298, unit: "unit" },
      { id: "m5", name: "Schluter Reno-T Transition Strip", qty_ordered: 3, qty_used: 0, unit_cost: 24, unit: "piece" },
      { id: "m6", name: '3/4" Birch Plywood', qty_ordered: 6, qty_used: 4, unit_cost: 68, unit: "sheet" },
    ],
    labor: [
      { id: "l1", name: "Mike Torrealba", hours: 8, rate: 85, date: "May 5" },
      { id: "l2", name: "Carlos Vega — Carpenter", hours: 12, rate: 68, date: "May 6" },
    ],
    receipts: [
      { id: "r1", vendor: "Pacific Building Supply", amount: 4920, category: "Materials", date: "May 3" },
    ],
    documents: [
      { id: "d1", name: "Signed Contract — Mehta.pdf", category: "Contract", size: "289 KB", date: "Apr 30", file_type: "application/pdf" },
      { id: "d2", name: "Cabinet Layout Approval.pdf", category: "Design", size: "1.1 MB", date: "May 3", file_type: "application/pdf" },
    ],
    quote: {
      material_total: 4200,
      labor_total: 3600,
      profit_margin_pct: 19,
      final_quote: 9200,
      addons: [],
      quote_status: "signed",
      signed_by_name: "David Mehta",
      signed_at: "May 1, 2026",
    },
    punchList: [
      { id: "pl1", description: "Demo existing cabinets and countertops", completed: true },
      { id: "pl2", description: "Rough-in plumbing for new sink location", completed: true },
      { id: "pl3", description: "Install upper and lower KraftMaid cabinets", completed: false },
      { id: "pl4", description: "Template and install Silestone countertops", completed: false },
      { id: "pl5", description: "Install Moen Arbor faucet and plumbing trim", completed: false },
    ],
  },

  // ── Job 3: Sellwood Deck Build ─────────────────────────────────────────────
  {
    slug: "sellwood-deck",
    job_number: "SDB-2026-003",
    name: "Sellwood Deck Build",
    address: "8891 SE Sellwood Blvd, Portland, OR 97202",
    types: ["decks_patios"],
    status: "completed",
    notes:
      "18×22 ft composite deck with Trex Transcend Tiki Torch. Trex Enhance railing. Hidden fastener system. Completed on schedule — client ecstatic.",
    created_at: "Mar 20, 2026",
    start_date: "Mar 24, 2026",
    estimated_completion_date: "Apr 30, 2026",
    completed_date: "Apr 30, 2026",
    lockbox_code: null,
    client: {
      name: "Robert & Nancy Fitzpatrick",
      company: null,
      phone: "(503) 239-8814",
      email: "fitzpatrick.sellwood@gmail.com",
    },
    photos: [
      { id: "p1", label: "Before — backyard with old rotting wood deck", category: "before" },
      { id: "p2", label: "During — footings poured, PT framing complete", category: "during" },
      { id: "p3", label: "After — completed Trex Transcend deck with railing", category: "after" },
    ],
    materials: [
      { id: "m1", name: "Trex Transcend Tiki Torch 5/4×6", qty_ordered: 94, qty_used: 94, unit_cost: 24.8, unit: "piece" },
      { id: "m2", name: "2×10×16 Pressure Treated Joists", qty_ordered: 18, qty_used: 18, unit_cost: 32.4, unit: "piece" },
      { id: "m3", name: "4×4×8 Pressure Treated Posts", qty_ordered: 8, qty_used: 8, unit_cost: 18.6, unit: "piece" },
      { id: "m4", name: "Trex Enhance Railing System", qty_ordered: 2, qty_used: 2, unit_cost: 284, unit: "section" },
      { id: "m5", name: "Trex Hidden Fastener Kit", qty_ordered: 3, qty_used: 3, unit_cost: 48, unit: "box" },
      { id: "m6", name: "3/8\" Galvanized Lag Bolts", qty_ordered: 2, qty_used: 2, unit_cost: 34, unit: "box" },
      { id: "m7", name: "Quikrete 80lb Concrete", qty_ordered: 16, qty_used: 16, unit_cost: 8.2, unit: "bag" },
    ],
    labor: [
      { id: "l1", name: "Mike Torrealba", hours: 28, rate: 85, date: "Mar 24" },
      { id: "l2", name: "Jesse Ramirez", hours: 20, rate: 68, date: "Mar 28" },
    ],
    receipts: [
      { id: "r1", vendor: "Parr Lumber — Milwaukie", amount: 2890.4, category: "Materials", date: "Mar 22" },
      { id: "r2", vendor: "Home Depot #6241", amount: 1084, category: "Materials", date: "Mar 24" },
    ],
    documents: [
      { id: "d1", name: "Permit #BP-2026-0872.pdf", category: "Permit", size: "156 KB", date: "Mar 20", file_type: "application/pdf" },
      { id: "d2", name: "Signed Contract — Fitzpatrick.pdf", category: "Contract", size: "398 KB", date: "Mar 21", file_type: "application/pdf" },
      { id: "d3", name: "Final Inspection — Passed.pdf", category: "Inspection", size: "201 KB", date: "Apr 30", file_type: "application/pdf" },
    ],
    quote: {
      material_total: 4500,
      labor_total: 4100,
      profit_margin_pct: 24,
      final_quote: 11400,
      addons: [],
      quote_status: "signed",
      signed_by_name: "Robert Fitzpatrick",
      signed_at: "Mar 22, 2026",
    },
    invoice: {
      number: "INV-2026-038",
      status: "paid",
      amount: 11400,
      sent_at: "Apr 25, 2026",
      due_date: "May 10, 2026",
      paid_at: "Apr 28, 2026",
    },
    punchList: [
      { id: "pl1", description: "Demo and haul old deck", completed: true },
      { id: "pl2", description: "Pour and cure all 8 footings", completed: true },
      { id: "pl3", description: "Install ledger board with lags", completed: true },
      { id: "pl4", description: "Frame PT joists with hangers", completed: true },
      { id: "pl5", description: "Install Trex Transcend decking — hidden fasteners", completed: true },
      { id: "pl6", description: "Install Trex Enhance railing system", completed: true },
    ],
  },
];

export function getDemoJob(slug: string): DemoJob | undefined {
  return DEMO_JOBS.find((j) => j.slug === slug);
}

// ── Profitability helpers ─────────────────────────────────────────────────────

export function calcDemoProfitability(job: DemoJob) {
  const actualMat = job.materials.reduce((s, m) => {
    if (!m.unit_cost) return s;
    const qty = m.qty_used ?? m.qty_ordered;
    return s + qty * m.unit_cost;
  }, 0);
  const actualLabor = job.labor.reduce((s, l) => s + l.hours * l.rate, 0);
  const totalActual = actualMat + actualLabor;
  const addonsTotal = job.quote.addons.reduce((s, a) => s + a.amount, 0);
  const totalQuote = job.quote.final_quote + addonsTotal;
  const fillPct = totalQuote > 0 ? Math.min((totalActual / totalQuote) * 100, 100) : 0;
  const budgetTotal = job.quote.material_total + job.quote.labor_total;
  const isOverQuote = totalActual >= totalQuote;
  const isOverBudget = totalActual > budgetTotal;
  const profitRemaining = totalQuote - totalActual;
  let status: "on_track" | "eating_margin" | "over_budget" = "on_track";
  if (isOverQuote) status = "over_budget";
  else if (isOverBudget) status = "eating_margin";
  return { actualMat, actualLabor, totalActual, totalQuote, fillPct, profitRemaining, status };
}
