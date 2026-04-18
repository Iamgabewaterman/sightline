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
  status: "unpaid" | "sent" | "paid";
  amount: number;
  due_date: string;
  paid_at: string | null;
  notes: string;
}

export interface DemoPunchItem {
  id: string;
  description: string;
  completed: boolean;
}

export interface DemoSubcontractor {
  id: string;
  company_name: string;
  trade: string;
  scope_description: string;
  quoted_amount: number;
  invoice_received: boolean;
  invoice_amount: number | null;
  paid: boolean;
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

export interface DemoDimensions {
  length_ft: number;
  width_ft: number;
  sqft: number;
}

export interface DemoJob {
  slug: string;
  name: string;
  address: string;
  types: string[];
  status: "active" | "completed";
  notes: string;
  created_at: string;
  start_date: string | null;
  completed_date: string | null;
  total_days: number | null;
  lockbox_code: string | null;
  client: DemoClient | null;
  dimensions: DemoDimensions | null;
  photos: DemoPhoto[];
  materials: DemoMaterial[];
  labor: DemoLabor[];
  subcontractors: DemoSubcontractor[];
  receipts: DemoReceipt[];
  documents: DemoDocument[];
  quote: DemoQuote;
  invoice?: DemoInvoice;
  punchList: DemoPunchItem[];
}

export const DEMO_JOBS: DemoJob[] = [
  {
    slug: "martinez-restoration",
    name: "Martinez Residence – Fire & Water Restoration",
    address: "1847 Creekview Dr, Beaverton, OR 97005",
    types: ["drywall", "flooring", "paint"],
    status: "active",
    notes:
      "Insurance claim #INS-2024-8847. Full gut to studs on main floor. Demo complete, asbestos clear. Complete by end of April per adjuster schedule.",
    created_at: "Mar 28, 2026",
    start_date: "Mar 28, 2026",
    completed_date: null,
    total_days: null,
    lockbox_code: null,
    client: { name: "Rosa Martinez", company: null, phone: "(503) 771-4892", email: "rosa.martinez@gmail.com" },
    dimensions: { length_ft: 48, width_ft: 32, sqft: 1536 },
    photos: [
      { id: "p1", label: "Before – Main floor water damage", category: "before" },
      { id: "p2", label: "During – Framing exposed, cleanup in progress", category: "during" },
      { id: "p3", label: "During – New drywall going up, east wall", category: "during" },
    ],
    materials: [
      { id: "m1", name: 'Drywall 1/2"', qty_ordered: 96, qty_used: 82, unit_cost: 14.5 },
      { id: "m2", name: "Joint Compound", qty_ordered: 18, qty_used: 12, unit_cost: 18.0 },
      { id: "m3", name: "Primer", qty_ordered: 8, qty_used: 6, unit_cost: 32.0 },
      { id: "m4", name: "LVP Flooring", qty_ordered: 1200, qty_used: 1140, unit_cost: 2.85 },
      { id: "m5", name: "Paint – Interior", qty_ordered: 8, qty_used: 5, unit_cost: 48.0 },
      { id: "m6", name: "Vapor Barrier", qty_ordered: 4, qty_used: 4, unit_cost: 67.0 },
      { id: "m7", name: "Insulation R-13", qty_ordered: 22, qty_used: 20, unit_cost: 42.0 },
    ],
    labor: [
      { id: "l1", name: "Demo Crew", hours: 32, rate: 45, date: "Apr 1" },
      { id: "l2", name: "Mike (Drywall)", hours: 48, rate: 55, date: "Apr 7" },
      { id: "l3", name: "Tyler (Flooring)", hours: 28, rate: 50, date: "Apr 12" },
    ],
    subcontractors: [
      {
        id: "s1",
        company_name: "QuickDry Remediation Co.",
        trade: "General",
        scope_description: "Water extraction, drying equipment setup & 3-day monitoring",
        quoted_amount: 2800,
        invoice_received: true,
        invoice_amount: 2800,
        paid: true,
      },
    ],
    receipts: [
      { id: "r1", vendor: "Home Depot #6241", amount: 847.32, category: "Materials", date: "Apr 2" },
    ],
    documents: [
      { id: "d1", name: "Insurance Claim #INS-2024-8847.pdf", category: "Insurance", size: "284 KB", date: "Mar 29", file_type: "application/pdf" },
    ],
    quote: {
      material_total: 8500,
      labor_total: 6200,
      profit_margin_pct: 24,
      final_quote: 19400,
      addons: [
        { name: "Insurance documentation prep", amount: 650 },
        { name: "Odor remediation treatment", amount: 480 },
      ],
      quote_status: "sent",
      signed_by_name: null,
      signed_at: null,
    },
    punchList: [
      { id: "pl1", description: "Remove water-damaged ceiling in hallway", completed: true },
      { id: "pl2", description: "Prime all new drywall (2 coats)", completed: true },
      { id: "pl3", description: "Install LVP flooring – living room & dining", completed: false },
      { id: "pl4", description: "Paint walls – Sherwin-Williams Accessible Beige", completed: false },
    ],
  },
  {
    slug: "thompson-deck",
    name: "Thompson Backyard – Cedar Deck Build",
    address: "4203 Ridgeline Ct, Hillsboro, OR 97124",
    types: ["decks_patios"],
    status: "active",
    notes:
      "16' × 24' deck with stairs. Owner wants built-in bench along north rail. Footings poured 4/1. Ledger and posts set. Framing next.",
    created_at: "Apr 1, 2026",
    start_date: "Apr 1, 2026",
    completed_date: null,
    total_days: null,
    lockbox_code: "7741",
    client: { name: "Robert Thompson", company: "Thompson Properties LLC", phone: "(503) 842-1156", email: null },
    dimensions: { length_ft: 24, width_ft: 16, sqft: 384 },
    photos: [
      { id: "p1", label: "Before – Backyard layout, string lines marked", category: "before" },
      { id: "p2", label: "During – Footings poured, posts and beam set", category: "during" },
    ],
    materials: [
      { id: "m1", name: "5/4×6 PT Decking 16ft", qty_ordered: 42, qty_used: 38, unit_cost: 8.9 },
      { id: "m2", name: "2×8 PT Joist 16ft", qty_ordered: 22, qty_used: 22, unit_cost: 12.4 },
      { id: "m3", name: "4×4 PT Post 8ft", qty_ordered: 14, qty_used: 12, unit_cost: 14.0 },
      { id: "m4", name: "Concrete Mix 80lb", qty_ordered: 24, qty_used: 24, unit_cost: 7.5 },
      { id: "m5", name: "Deck Screws 350ct", qty_ordered: 6, qty_used: 4, unit_cost: 28.0 },
      { id: "m6", name: "Joist Hanger", qty_ordered: 40, qty_used: 36, unit_cost: 3.2 },
    ],
    labor: [
      { id: "l1", name: "Jason & Crew", hours: 28, rate: 58, date: "Apr 3" },
      { id: "l2", name: "Self", hours: 16, rate: 45, date: "Apr 5" },
    ],
    subcontractors: [],
    receipts: [
      { id: "r1", vendor: "Pacific Building Supply", amount: 2340.0, category: "Materials", date: "Apr 3" },
    ],
    documents: [
      { id: "d1", name: "Permit #BP-2026-0441.pdf", category: "Permit", size: "156 KB", date: "Mar 30", file_type: "application/pdf" },
      { id: "d2", name: "Signed Contract – Thompson.pdf", category: "Contract", size: "412 KB", date: "Apr 1", file_type: "application/pdf" },
    ],
    quote: {
      material_total: 5800,
      labor_total: 3400,
      profit_margin_pct: 26,
      final_quote: 12450,
      addons: [
        { name: "Built-in bench seating (north rail)", amount: 950 },
        { name: "Post lighting – 4 fixtures", amount: 680 },
      ],
      quote_status: "signed",
      signed_by_name: "Robert Thompson",
      signed_at: "Apr 4, 2026",
    },
    punchList: [
      { id: "pl1", description: "Pour and set all 7 deck footings", completed: true },
      { id: "pl2", description: "Install ledger board with lag screws", completed: true },
      { id: "pl3", description: "Set posts and beam, confirm level", completed: true },
      { id: "pl4", description: "Frame joists with hangers", completed: false },
      { id: "pl5", description: "Install decking boards", completed: false },
    ],
  },
  {
    slug: "chen-bath",
    name: "Chen Master Bath Remodel",
    address: "718 Hawthorne Pl, Portland, OR 97214",
    types: ["tile", "plumbing"],
    status: "completed",
    notes:
      "Full gut and rebuild. Walk-in shower with tile bench, frameless glass door. New Kohler fixtures. Completed on time, client very happy.",
    created_at: "Feb 15, 2026",
    start_date: "Feb 15, 2026",
    completed_date: "Mar 20, 2026",
    total_days: 26,
    lockbox_code: null,
    client: { name: "David Chen", company: null, phone: "(971) 304-7788", email: "david.chen@icloud.com" },
    dimensions: { length_ft: 12, width_ft: 8, sqft: 96 },
    photos: [
      { id: "p1", label: "Before – Original bathroom, all original fixtures", category: "before" },
      { id: "p2", label: "After – Completed shower with frameless glass door", category: "after" },
    ],
    materials: [
      { id: "m1", name: "Tile 12×12 (Natural Stone)", qty_ordered: 180, qty_used: 162, unit_cost: 4.2 },
      { id: "m2", name: 'Cement Board 1/2"', qty_ordered: 24, qty_used: 22, unit_cost: 18.0 },
      { id: "m3", name: "Grout – Polyblend", qty_ordered: 12, qty_used: 9, unit_cost: 14.0 },
      { id: "m4", name: "Kohler Revel Shower Kit", qty_ordered: 1, qty_used: 1, unit_cost: 685.0 },
      { id: "m5", name: 'PVC Pipe 2"', qty_ordered: 3, qty_used: 2, unit_cost: 22.0 },
    ],
    labor: [
      { id: "l1", name: "Roberto (Tile)", hours: 40, rate: 60, date: "Mar 5" },
      { id: "l2", name: "Mike (Plumbing)", hours: 16, rate: 85, date: "Mar 14" },
    ],
    subcontractors: [
      {
        id: "s1",
        company_name: "Frameless Glass NW",
        trade: "General",
        scope_description: "Frameless shower door & hardware – supply and install",
        quoted_amount: 1400,
        invoice_received: true,
        invoice_amount: 1400,
        paid: true,
      },
    ],
    receipts: [
      { id: "r1", vendor: "Tile Depot Portland", amount: 1290.0, category: "Materials", date: "Feb 18" },
      { id: "r2", vendor: "Ferguson Plumbing Supply", amount: 742.5, category: "Materials", date: "Feb 22" },
    ],
    documents: [
      { id: "d1", name: "Signed Contract – Chen.pdf", category: "Contract", size: "398 KB", date: "Feb 15", file_type: "application/pdf" },
      { id: "d2", name: "Final Inspection Certificate.pdf", category: "Inspection", size: "201 KB", date: "Mar 21", file_type: "application/pdf" },
    ],
    quote: {
      material_total: 4200,
      labor_total: 2900,
      profit_margin_pct: 30,
      final_quote: 10150,
      addons: [{ name: "Custom tile bench fabrication", amount: 450 }],
      quote_status: "signed",
      signed_by_name: "David Chen",
      signed_at: "Feb 20, 2026",
    },
    invoice: {
      status: "paid",
      amount: 10600,
      due_date: "Mar 25, 2026",
      paid_at: "Mar 22, 2026",
      notes: "Payment received via check #4892. Thank you for your business!",
    },
    punchList: [
      { id: "pl1", description: "Waterproof shower pan and walls", completed: true },
      { id: "pl2", description: "Install cement board backing", completed: true },
      { id: "pl3", description: "Set tile floor and shower walls", completed: true },
      { id: "pl4", description: "Install Kohler fixtures and plumbing", completed: true },
      { id: "pl5", description: "Grout and seal all tile surfaces", completed: true },
    ],
  },
];

export function getDemoJob(slug: string): DemoJob | undefined {
  return DEMO_JOBS.find((j) => j.slug === slug);
}
