"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { Invoice, InvoiceStatus, PaymentTerms, Estimate, QuoteAddon, Client, PaymentMilestone } from "@/types";
import { createInvoice, updateInvoiceStatus, updateInvoice } from "@/app/actions/invoices";
import { saveMilestones } from "@/app/actions/milestones";
import { generateAndDownloadInvoicePDF } from "@/lib/generateInvoicePDF";
import { createClient } from "@/lib/supabase/client";
import { useJobCost } from "./JobCostContext";
import { useRole } from "@/hooks/useRole";

// ── Preset line item categories ───────────────────────────────────────────────

const PRESET_CATEGORIES: { name: string; items: string[] }[] = [
  {
    name: "General",
    items: [
      "Demo & debris removal",
      "Site preparation & cleanup",
      "Project management & supervision",
      "Permits & inspections",
      "Equipment & tool rental",
    ],
  },
  {
    name: "Structural & Framing",
    items: [
      "Framing & structural work",
      "Foundation work",
      "Concrete & flatwork",
      "Roofing & flashing",
      "Insulation",
    ],
  },
  {
    name: "Interior",
    items: [
      "Drywall & patching",
      "Interior painting",
      "Flooring installation",
      "Tile work",
      "Cabinetry & millwork",
      "Trim & finish carpentry",
      "Door & window installation",
    ],
  },
  {
    name: "Exterior",
    items: [
      "Exterior painting",
      "Siding installation",
      "Deck & patio construction",
      "Fencing",
      "Gutters & drainage",
    ],
  },
  {
    name: "Mechanical",
    items: [
      "Plumbing rough-in & finish",
      "Electrical rough-in & finish",
      "HVAC installation & ducting",
      "Water heater installation",
    ],
  },
  {
    name: "Restoration",
    items: [
      "Water damage remediation",
      "Fire damage remediation",
      "Mold remediation",
      "Structural drying",
      "Content pack-out & storage",
    ],
  },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClientLineItemRow {
  id: string;
  name: string;
  amount: string;
}

interface MilestoneRow {
  id: string;
  label: string;
  amount: string;
  dueDate: string;
}

interface SavedLineItemData {
  id: string;
  name: string;
  amount: number;
}

type SplitMode = "full" | "two" | "three" | "custom";

// ── Constants ─────────────────────────────────────────────────────────────────

const TERMS_OPTIONS: { value: PaymentTerms; label: string; days: number }[] = [
  { value: "due_on_receipt", label: "Due on Receipt", days: 0 },
  { value: "net_15",         label: "Net 15",          days: 15 },
  { value: "net_30",         label: "Net 30",          days: 30 },
  { value: "net_45",         label: "Net 45",          days: 45 },
];

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string; bg: string }> = {
  unpaid: { label: "Unpaid", color: "text-red-400",    bg: "bg-red-500/20 border-red-500/40"    },
  sent:   { label: "Sent",   color: "text-yellow-400", bg: "bg-yellow-500/20 border-yellow-500/40" },
  paid:   { label: "Paid",   color: "text-green-400",  bg: "bg-green-500/20 border-green-500/40"  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function termsLabel(t: PaymentTerms) {
  return TERMS_OPTIONS.find((o) => o.value === t)?.label ?? t;
}

function calcDueDate(terms: PaymentTerms): Date | null {
  const opt = TERMS_OPTIONS.find((o) => o.value === terms);
  if (!opt || opt.days === 0) return null;
  const base = new Date();
  base.setDate(base.getDate() + opt.days);
  return base;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateFull(d: Date) {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function fmtNum(n: number) {
  return "$" + Math.round(n).toLocaleString();
}

function todayStr() {
  return new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function isOverdue(invoice: Invoice): boolean {
  if (invoice.status === "paid") return false;
  if (!invoice.due_date) return false;
  return invoice.due_date < new Date().toISOString().split("T")[0];
}

function daysOverdue(invoice: Invoice): number {
  if (!invoice.due_date) return 0;
  const ms = new Date().getTime() - new Date(invoice.due_date).getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function uid(): string {
  return Math.random().toString(36).slice(2);
}

function newRow(): ClientLineItemRow {
  return { id: uid(), name: "", amount: "" };
}

function initClientRows(invoice: Invoice | null): ClientLineItemRow[] {
  if (invoice?.client_line_items?.length) {
    return invoice.client_line_items.map((item) => ({
      id: uid(),
      name: item.name,
      amount: item.amount ? item.amount.toString() : "",
    }));
  }
  return [newRow()];
}

function rowsToItems(rows: ClientLineItemRow[]): Array<{ name: string; amount: number }> {
  return rows.filter((r) => r.name.trim()).map((r) => ({
    name: r.name.trim(),
    amount: parseFloat(r.amount) || 0,
  }));
}

function detectSplitMode(milestones: PaymentMilestone[]): SplitMode {
  if (milestones.length === 0) return "full";
  if (milestones.length === 2) return "two";
  if (milestones.length === 3) return "three";
  return "custom";
}

function initMilestoneRows(milestones: PaymentMilestone[]): MilestoneRow[] {
  return milestones
    .filter((m) => m.status === "unpaid")
    .map((m) => ({
      id: uid(),
      label: m.label,
      amount: m.amount.toString(),
      dueDate: m.due_date ?? "",
    }));
}

function twoPaymentRows(total: number): MilestoneRow[] {
  const half = Math.round(total / 2);
  return [
    { id: uid(), label: "Deposit", amount: half.toString(), dueDate: "" },
    { id: uid(), label: "Final Payment", amount: (total - half).toString(), dueDate: "" },
  ];
}

function threePaymentRows(total: number): MilestoneRow[] {
  const quarter = Math.round(total * 0.25);
  const half = Math.round(total * 0.5);
  return [
    { id: uid(), label: "Deposit", amount: quarter.toString(), dueDate: "" },
    { id: uid(), label: "Progress Payment", amount: half.toString(), dueDate: "" },
    { id: uid(), label: "Final Payment", amount: (total - quarter - half).toString(), dueDate: "" },
  ];
}

function milestoneRowsToSave(rows: MilestoneRow[]): Array<{ label: string; amount: number; dueDate: string | null }> {
  return rows.filter((r) => r.label.trim()).map((r) => ({
    label: r.label.trim(),
    amount: parseFloat(r.amount) || 0,
    dueDate: r.dueDate || null,
  }));
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function InvoiceSection({
  jobId,
  jobName,
  jobAddress,
  estimate,
  initialInvoice,
  jobClient,
  initialMilestones = [],
}: {
  jobId: string;
  jobName: string;
  jobAddress: string;
  estimate: Pick<Estimate, "material_total" | "labor_total" | "final_quote" | "addons" | "profit_margin_pct"> | null;
  initialInvoice: Invoice | null;
  jobClient: Pick<Client, "id" | "name" | "company" | "phone" | "email" | "address"> | null;
  initialMilestones?: PaymentMilestone[];
}) {
  const { role, can_see_financials } = useRole();
  const { changeOrders } = useJobCost();

  // All hooks before any conditional returns
  const [invoice, setInvoice] = useState<Invoice | null>(initialInvoice);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [pdfLoading, setPdfLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Pre-creation form state
  const [terms, setTerms] = useState<PaymentTerms>("net_30");
  const [notes, setNotes] = useState("");

  // Display settings
  const [showMaterials, setShowMaterials] = useState(initialInvoice?.display_show_materials ?? false);
  const [showLabor, setShowLabor] = useState(initialInvoice?.display_show_labor ?? false);
  const [showItemizedMaterials, setShowItemizedMaterials] = useState(initialInvoice?.display_show_itemized_materials ?? false);
  const [showProfitMargin, setShowProfitMargin] = useState(initialInvoice?.display_show_profit_margin ?? false);
  const [clientLineItems, setClientLineItems] = useState<ClientLineItemRow[]>(() => initClientRows(initialInvoice));

  // Payment schedule
  const [splitMode, setSplitMode] = useState<SplitMode>(() => detectSplitMode(initialMilestones));
  const [milestoneRows, setMilestoneRows] = useState<MilestoneRow[]>(() => initMilestoneRows(initialMilestones));
  const [liveMilestones, setLiveMilestones] = useState<PaymentMilestone[]>(initialMilestones);

  // Saved line items from DB
  const [savedLineItems, setSavedLineItems] = useState<SavedLineItemData[]>([]);

  // Post-creation edit state
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(initialInvoice?.notes ?? "");
  const [editingDisplay, setEditingDisplay] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(false);

  // Preset panel state
  const [showPresetsPanel, setShowPresetsPanel] = useState(false);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [customName, setCustomName] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("saved_line_items")
        .select("id, name, amount")
        .eq("user_id", user.id)
        .order("name")
        .then(({ data }) => { if (data) setSavedLineItems(data); });
    });
  }, []);

  // Guards
  if (role === "field_member" && !can_see_financials) return null;
  if (!estimate) return null;

  // Calculations
  const addons = (estimate.addons as QuoteAddon[]) ?? [];
  const addonsTotal = addons.reduce((s, a) => s + Number(a.amount), 0);
  const changeOrdersTotal = changeOrders.reduce((s, o) => s + Number(o.amount), 0);
  const grandTotal = estimate.final_quote + addonsTotal + changeOrdersTotal;
  const invoiceNumber = `INV-${jobId.slice(0, 8).toUpperCase()}`;

  // Client line items totals
  const clientLineItemsTotal = clientLineItems.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const hasClientItems = clientLineItems.some((r) => r.name.trim());
  const totalMismatch = hasClientItems && Math.abs(clientLineItemsTotal - grandTotal) > 0.01;

  // Milestone totals
  const milestonesTotal = milestoneRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const paidMilestones = liveMilestones.filter((m) => m.status === "paid");
  const milestoneMismatch = splitMode !== "full" && milestoneRows.length > 0 && Math.abs(milestonesTotal - grandTotal) > 0.01;

  // ── Handlers ──────────────────────────────────────────────────────────────

  function applySplitMode(mode: SplitMode) {
    setSplitMode(mode);
    if (mode === "two") setMilestoneRows(twoPaymentRows(grandTotal));
    else if (mode === "three") setMilestoneRows(threePaymentRows(grandTotal));
    else if (mode === "custom") setMilestoneRows([{ id: uid(), label: "", amount: "", dueDate: "" }]);
    else setMilestoneRows([]);
  }

  function updateMilestone(id: string, field: keyof MilestoneRow, value: string) {
    setMilestoneRows((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r));
  }

  function removeMilestone(id: string) {
    setMilestoneRows((prev) => {
      const next = prev.filter((r) => r.id !== id);
      return next.length ? next : [{ id: uid(), label: "", amount: "", dueDate: "" }];
    });
  }

  function addPreset(name: string) {
    setClientLineItems((prev) => [...prev, { id: uid(), name, amount: "" }]);
    setShowPresetsPanel(false);
  }

  function updateRow(id: string, field: "name" | "amount", value: string) {
    setClientLineItems((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r));
  }

  function removeRow(id: string) {
    setClientLineItems((prev) => {
      const next = prev.filter((r) => r.id !== id);
      return next.length ? next : [newRow()];
    });
  }

  function toggleCategory(name: string) {
    setOpenCategories((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  function addCustom() {
    if (!customName.trim()) return;
    setClientLineItems((prev) => [...prev, { id: uid(), name: customName.trim(), amount: "" }]);
    setCustomName("");
    setShowPresetsPanel(false);
  }

  async function handleGenerate() {
    setCreating(true);
    setError("");
    const res = await createInvoice(jobId, grandTotal, {
      clientId: jobClient?.id ?? null,
      paymentTerms: terms,
      notes: notes.trim() || undefined,
      displayShowMaterials: showMaterials,
      displayShowLabor: showLabor,
      displayShowItemizedMaterials: showItemizedMaterials,
      displayShowProfitMargin: showProfitMargin,
      clientLineItems: rowsToItems(clientLineItems),
    });
    if (res.error) { setError(res.error); setCreating(false); return; }
    const inv = res.invoice!;

    // Save milestones if split mode is not full
    if (splitMode !== "full" && milestoneRows.length > 0) {
      await saveMilestones(inv.id, milestoneRowsToSave(milestoneRows));
      // Reflect paid milestones in live state
      setLiveMilestones(milestoneRows.map((r, i) => ({
        id: `new-${i}`,
        invoice_id: inv.id,
        user_id: "",
        label: r.label,
        amount: parseFloat(r.amount) || 0,
        due_date: r.dueDate || null,
        status: "unpaid",
        paid_at: null,
        sort_order: i,
        created_at: new Date().toISOString(),
      })));
    }

    setCreating(false);
    setInvoice(inv);
  }

  function handleStatusChange(status: InvoiceStatus) {
    if (!invoice || status === invoice.status) return;
    startTransition(async () => {
      const res = await updateInvoiceStatus(invoice.id, status);
      if (res.invoice) setInvoice(res.invoice);
    });
  }

  async function handleSaveNotes() {
    if (!invoice) return;
    const res = await updateInvoice(invoice.id, { notes: notesDraft.trim() || null });
    if (res.invoice) { setInvoice(res.invoice); setEditingNotes(false); }
  }

  async function handleSaveDisplaySettings() {
    if (!invoice) return;
    const res = await updateInvoice(invoice.id, {
      display_show_materials: showMaterials,
      display_show_labor: showLabor,
      display_show_itemized_materials: showItemizedMaterials,
      display_show_profit_margin: showProfitMargin,
      client_line_items: rowsToItems(clientLineItems),
    });
    if (res.invoice) { setInvoice(res.invoice); setEditingDisplay(false); }
  }

  async function handleSaveSchedule() {
    if (!invoice) return;
    const toSave = splitMode === "full" ? [] : milestoneRowsToSave(milestoneRows);
    await saveMilestones(invoice.id, toSave);
    // Update live milestones (keep paid ones, replace unpaid with new rows)
    setLiveMilestones([
      ...paidMilestones,
      ...milestoneRows.filter(r => r.label.trim()).map((r, i) => ({
        id: `new-${i}`,
        invoice_id: invoice.id,
        user_id: "",
        label: r.label,
        amount: parseFloat(r.amount) || 0,
        due_date: r.dueDate || null,
        status: "unpaid" as const,
        paid_at: null,
        sort_order: paidMilestones.length + i,
        created_at: new Date().toISOString(),
      })),
    ]);
    setEditingSchedule(false);
  }

  function cancelDisplayEdit(inv: Invoice) {
    setShowMaterials(inv.display_show_materials);
    setShowLabor(inv.display_show_labor);
    setShowItemizedMaterials(inv.display_show_itemized_materials);
    setShowProfitMargin(inv.display_show_profit_margin);
    setClientLineItems(initClientRows(inv));
    setEditingDisplay(false);
    setShowPresetsPanel(false);
  }

  function cancelScheduleEdit() {
    setSplitMode(detectSplitMode(liveMilestones));
    setMilestoneRows(initMilestoneRows(liveMilestones));
    setEditingSchedule(false);
  }

  async function handleShareLink() {
    const url = `${window.location.origin}/pay/${invoice!.id}`;
    if (navigator.share) {
      await navigator.share({ title: invoiceNumber, url });
      return;
    }
    let success = false;
    if (navigator.clipboard) {
      try { await navigator.clipboard.writeText(url); success = true; } catch { /* fallthrough */ }
    }
    if (!success) {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      try { document.execCommand("copy"); success = true; } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
    if (success) { setCopied(true); setTimeout(() => setCopied(false), 2500); }
  }

  async function handleDownloadPDF() {
    setPdfLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!estimate) return;
      const { data: bp } = await supabase
        .from("business_profiles")
        .select("business_name,owner_name,license_number,address,phone,email,logo_path")
        .eq("user_id", user!.id)
        .maybeSingle();

      let logoUrl: string | null = null;
      if (bp?.logo_path) {
        const { data: signed } = await supabase.storage
          .from("business-logos")
          .createSignedUrl(bp.logo_path, 300);
        logoUrl = signed?.signedUrl ?? null;
      }

      const baseAddons = addons
        .filter((a) => a.name && Number(a.amount) !== 0)
        .map((a) => ({ name: a.name, amount: Number(a.amount) }));
      const coLineItems = changeOrders.map((o) => ({ name: `CO: ${o.description}`, amount: Number(o.amount) }));

      const inv = invoice!;
      const dueDate = inv.due_date
        ? new Date(inv.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
        : null;
      const paidDate = inv.paid_at
        ? new Date(inv.paid_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
        : null;

      await generateAndDownloadInvoicePDF({
        contractorEmail: user?.email ?? "",
        jobName,
        jobAddress,
        date: todayStr(),
        invoiceNumber,
        invoiceId: inv.id,
        materialsTotal: estimate.material_total,
        laborTotal: estimate.labor_total,
        profitMarginPct: estimate.profit_margin_pct,
        addons: [...baseAddons, ...coLineItems],
        grandTotal,
        businessProfile: bp,
        logoUrl,
        client: jobClient
          ? { name: jobClient.name, company: jobClient.company, address: jobClient.address, phone: jobClient.phone, email: jobClient.email }
          : null,
        paymentTermsLabel: termsLabel(inv.payment_terms),
        dueDate,
        notes: inv.notes,
        status: inv.status,
        paidDate,
        displayShowMaterials: inv.display_show_materials,
        displayShowLabor: inv.display_show_labor,
        displayShowProfitMargin: inv.display_show_profit_margin,
        clientLineItems: inv.client_line_items,
        milestones: liveMilestones.length > 0 ? liveMilestones : undefined,
      });
    } finally {
      setPdfLoading(false);
    }
  }

  // ── Shared render helpers ─────────────────────────────────────────────────

  function renderInternalBreakdown() {
    return (
      <div className="mb-5 bg-[#141414] border border-[#2a2a2a] rounded-xl px-4 py-3">
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Your Internal Breakdown</p>
        <div className="flex justify-between text-sm mb-1.5">
          <span className="text-gray-400">Materials</span>
          <span className="text-white">{fmtNum(estimate!.material_total)}</span>
        </div>
        <div className="flex justify-between text-sm mb-1.5">
          <span className="text-gray-400">Labor</span>
          <span className="text-white">{fmtNum(estimate!.labor_total)}</span>
        </div>
        {addonsTotal !== 0 && (
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-gray-400">Add-ons</span>
            <span className="text-white">{fmtNum(addonsTotal)}</span>
          </div>
        )}
        {changeOrdersTotal !== 0 && (
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-gray-400">Change Orders</span>
            <span className="text-white">{fmtNum(changeOrdersTotal)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm mt-2 pt-2 border-t border-[#2a2a2a]">
          <span className="text-gray-300 font-semibold">Margin</span>
          <span className="text-orange-400 font-semibold">{estimate!.profit_margin_pct}%</span>
        </div>
      </div>
    );
  }

  function renderPaymentSchedule() {
    const SPLIT_OPTIONS: { mode: SplitMode; label: string; sub: string }[] = [
      { mode: "full",   label: "Full",       sub: "Single payment" },
      { mode: "two",    label: "2 Payments", sub: "50 / 50" },
      { mode: "three",  label: "3 Payments", sub: "25 / 50 / 25" },
      { mode: "custom", label: "Custom",     sub: "You set it" },
    ];

    return (
      <div className="mb-5">
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">Payment Schedule</p>
        <p className="text-gray-500 text-xs mb-3">Split the total into milestones. The invoice total never changes.</p>

        {/* Mode selector */}
        <div className="grid grid-cols-4 gap-1.5 mb-4">
          {SPLIT_OPTIONS.map((opt) => (
            <button
              key={opt.mode}
              type="button"
              onClick={() => applySplitMode(opt.mode)}
              className={`flex flex-col items-center py-2.5 px-1 rounded-xl border text-center transition-colors active:scale-95 ${
                splitMode === opt.mode
                  ? "bg-orange-500/20 border-orange-500/40 text-orange-400"
                  : "bg-[#242424] border-[#2a2a2a] text-gray-400"
              }`}
            >
              <span className="text-xs font-bold leading-tight">{opt.label}</span>
              <span className="text-[10px] text-gray-500 mt-0.5 leading-tight">{opt.sub}</span>
            </button>
          ))}
        </div>

        {/* Paid milestones (locked) */}
        {paidMilestones.length > 0 && (
          <div className="mb-3">
            {paidMilestones.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2 px-3 bg-green-500/5 border border-green-500/20 rounded-xl mb-1.5">
                <div>
                  <span className="text-green-400 text-sm font-semibold">{m.label}</span>
                  {m.paid_at && <span className="text-green-600 text-xs ml-2">Paid {fmtDate(m.paid_at)}</span>}
                </div>
                <span className="text-green-400 font-bold text-sm">{fmtNum(m.amount)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Editable milestone rows */}
        {splitMode !== "full" && (
          <>
            <div className="flex flex-col gap-2 mb-3">
              {milestoneRows.map((row) => (
                <div key={row.id} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3">
                  <div className="flex gap-2 mb-2">
                    <input
                      value={row.label}
                      onChange={(e) => updateMilestone(row.id, "label", e.target.value)}
                      placeholder="Label (e.g. Deposit)"
                      className="flex-1 bg-[#242424] border border-[#2a2a2a] text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 min-w-0"
                    />
                    <div className="relative flex-shrink-0">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">$</span>
                      <input
                        value={row.amount}
                        onChange={(e) => updateMilestone(row.id, "amount", e.target.value)}
                        placeholder="0"
                        inputMode="decimal"
                        className="w-24 bg-[#242424] border border-[#2a2a2a] text-white rounded-lg pl-6 pr-3 py-2.5 text-sm focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    {splitMode === "custom" && (
                      <button
                        type="button"
                        onClick={() => removeMilestone(row.id)}
                        className="text-gray-600 active:text-red-400 transition-colors p-2 rounded-lg active:scale-95 flex-shrink-0"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    )}
                  </div>
                  <input
                    type="date"
                    value={row.dueDate}
                    onChange={(e) => updateMilestone(row.id, "dueDate", e.target.value)}
                    className="w-full bg-[#242424] border border-[#2a2a2a] text-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>
              ))}
            </div>

            {/* Custom add row */}
            {splitMode === "custom" && (
              <button
                type="button"
                onClick={() => setMilestoneRows((prev) => [...prev, { id: uid(), label: "", amount: "", dueDate: "" }])}
                className="w-full bg-[#242424] border border-[#2a2a2a] text-gray-400 font-semibold text-sm py-3 rounded-xl active:scale-95 transition-transform mb-3"
              >
                + Add Milestone
              </button>
            )}

            {/* Total check */}
            <div className={`flex justify-between items-center px-4 py-2.5 rounded-xl text-sm ${milestoneMismatch ? "bg-yellow-500/10 border border-yellow-500/30" : "bg-[#1a1a1a] border border-[#2a2a2a]"}`}>
              <span className={milestoneMismatch ? "text-yellow-300" : "text-gray-500"}>
                {milestoneMismatch ? "⚠ Milestone total mismatch" : "Milestones total"}
              </span>
              <span className={`font-bold font-mono ${milestoneMismatch ? "text-yellow-400" : "text-gray-300"}`}>
                {fmtNum(milestonesTotal)}
                {milestoneMismatch && <span className="text-yellow-500 font-normal ml-1">≠ {fmtNum(grandTotal)}</span>}
              </span>
            </div>
          </>
        )}
      </div>
    );
  }

  function renderDisplaySettings() {
    return (
      <div className="mb-5">
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">Invoice Display Settings</p>
        <p className="text-gray-500 text-xs mb-3">What the client sees on the invoice and payment page. All off by default.</p>
        <div className="flex flex-col gap-2">
          {(
            [
              { on: showMaterials,         set: setShowMaterials,         label: "Show materials total" },
              { on: showLabor,             set: setShowLabor,             label: "Show labor total" },
              { on: showItemizedMaterials, set: setShowItemizedMaterials, label: "Show itemized materials list" },
              { on: showProfitMargin,      set: setShowProfitMargin,      label: "Show profit / margin" },
            ] as const
          ).map(({ on, set, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => set(!on)}
              className="flex items-center justify-between w-full py-3 px-4 bg-[#242424] border border-[#2a2a2a] rounded-xl active:scale-95 transition-transform"
            >
              <span className="text-gray-300 text-sm">{label}</span>
              <div className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${on ? "bg-orange-500" : "bg-[#3a3a3a]"}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-6" : "translate-x-1"}`} />
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  function renderClientLineItems() {
    return (
      <div className="mb-5">
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">Client-Facing Line Items</p>
        <p className="text-gray-500 text-xs mb-3">Build what the client sees. Total should match {fmtNum(grandTotal)}.</p>

        <div className="flex flex-col gap-2 mb-3">
          {clientLineItems.map((row) => (
            <div key={row.id} className="flex gap-2 items-center">
              <input
                value={row.name}
                onChange={(e) => updateRow(row.id, "name", e.target.value)}
                placeholder="Line item description"
                className="flex-1 bg-[#242424] border border-[#2a2a2a] text-white rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-orange-500 min-w-0"
              />
              <div className="relative flex-shrink-0">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">$</span>
                <input
                  value={row.amount}
                  onChange={(e) => updateRow(row.id, "amount", e.target.value)}
                  placeholder="0"
                  inputMode="decimal"
                  className="w-24 bg-[#242424] border border-[#2a2a2a] text-white rounded-xl pl-6 pr-3 py-3 text-sm focus:outline-none focus:border-orange-500"
                />
              </div>
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                className="text-gray-600 active:text-red-400 transition-colors p-2 rounded-xl active:scale-95 flex-shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          ))}
        </div>

        <div className={`flex justify-between items-center px-4 py-2.5 rounded-xl mb-3 text-sm ${totalMismatch ? "bg-yellow-500/10 border border-yellow-500/30" : "bg-[#1a1a1a] border border-[#2a2a2a]"}`}>
          <span className={totalMismatch ? "text-yellow-300" : "text-gray-500"}>
            {totalMismatch ? "⚠ Total mismatch" : "Line items total"}
          </span>
          <span className={`font-bold font-mono ${totalMismatch ? "text-yellow-400" : "text-gray-300"}`}>
            {fmtNum(clientLineItemsTotal)}
            {totalMismatch && <span className="text-yellow-500 font-normal ml-1">≠ {fmtNum(grandTotal)}</span>}
          </span>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setClientLineItems((prev) => [...prev, newRow()])}
            className="flex-1 bg-[#242424] border border-[#2a2a2a] text-gray-400 font-semibold text-sm py-3 rounded-xl active:scale-95 transition-transform"
          >
            + Add Row
          </button>
          <button
            type="button"
            onClick={() => setShowPresetsPanel((p) => !p)}
            className={`flex-1 border font-semibold text-sm py-3 rounded-xl active:scale-95 transition-transform ${showPresetsPanel ? "bg-orange-500/20 border-orange-500/40 text-orange-400" : "bg-[#242424] border-[#2a2a2a] text-orange-400"}`}
          >
            {showPresetsPanel ? "Hide Presets" : "Add Preset"}
          </button>
        </div>

        {showPresetsPanel && (
          <div className="mt-3 bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden">
            {savedLineItems.length > 0 && (
              <div className="border-b border-[#2a2a2a] px-4 py-3">
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">Saved</p>
                <div className="flex flex-col gap-0.5">
                  {savedLineItems.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => addPreset(s.name)}
                      className="text-left text-sm text-gray-300 py-1.5 px-2 rounded-lg active:bg-orange-500/10 active:text-orange-400 transition-colors"
                    >
                      {s.name}
                      {s.amount > 0 && <span className="text-gray-500 ml-1">(${s.amount.toLocaleString()})</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {PRESET_CATEGORIES.map((cat) => (
              <div key={cat.name} className="border-b border-[#2a2a2a] last:border-0">
                <button
                  type="button"
                  onClick={() => toggleCategory(cat.name)}
                  className="w-full flex justify-between items-center px-4 py-3 text-left active:bg-[#1a1a1a] transition-colors"
                >
                  <span className="text-gray-300 text-sm font-semibold">{cat.name}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`text-gray-500 transition-transform ${openCategories[cat.name] ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                {openCategories[cat.name] && (
                  <div className="px-4 pb-3 flex flex-col gap-0.5">
                    {cat.items.map((item) => (
                      <button key={item} type="button" onClick={() => addPreset(item)} className="text-left text-sm text-gray-400 py-1.5 px-2 rounded-lg active:bg-orange-500/10 active:text-orange-400 transition-colors">{item}</button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="px-4 py-3">
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">Custom</p>
              <div className="flex gap-2">
                <input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Describe the work…"
                  onKeyDown={(e) => { if (e.key === "Enter") addCustom(); }}
                  className="flex-1 bg-[#242424] border border-[#2a2a2a] text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500"
                />
                <button type="button" onClick={addCustom} className="bg-orange-500/20 border border-orange-500/30 text-orange-400 font-semibold text-sm px-4 py-2.5 rounded-xl active:scale-95 transition-transform">Add</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── No invoice yet (create mode) ──────────────────────────────────────────

  if (!invoice) {
    const previewDue = calcDueDate(terms);
    return (
      <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4">
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Invoice</p>

        {!jobClient && (
          <div className="flex items-start gap-2 mb-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#EAB308" strokeWidth="2" strokeLinecap="round" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p className="text-yellow-300 text-sm">No client linked. <Link href={`/jobs/${jobId}/edit`} className="underline font-semibold">Edit job →</Link></p>
          </div>
        )}

        <p className="text-gray-500 text-sm mb-5">Total: <span className="text-white font-bold">{fmtNum(grandTotal)}</span></p>

        {renderInternalBreakdown()}
        {renderPaymentSchedule()}
        {renderDisplaySettings()}
        {renderClientLineItems()}

        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Payment Terms</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {TERMS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTerms(opt.value)}
              className={`py-3 rounded-xl text-sm font-semibold border transition-colors active:scale-95 ${terms === opt.value ? "bg-orange-500/20 border-orange-500/40 text-orange-400" : "bg-[#242424] border-[#2a2a2a] text-gray-400"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {previewDue && <p className="text-gray-500 text-xs mb-4">Due {fmtDateFull(previewDue)}</p>}

        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Notes (optional)</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Payment instructions, thank you note…"
          rows={3}
          className="w-full bg-[#242424] border border-[#2a2a2a] text-white rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-500 resize-none mb-4"
        />

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <button
          onClick={handleGenerate}
          disabled={creating}
          className="w-full bg-orange-500 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
        >
          {creating ? "Creating…" : "Generate Invoice"}
        </button>
      </div>
    );
  }

  // ── Invoice exists ────────────────────────────────────────────────────────

  const overdue = isOverdue(invoice);
  const cfg = STATUS_CONFIG[invoice.status];
  const invDue = invoice.due_date
    ? new Date(invoice.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Invoice</p>
        <div className="flex items-center gap-2">
          {overdue && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full border bg-red-500/20 border-red-500/40 text-red-400">
              Overdue {daysOverdue(invoice)}d
            </span>
          )}
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
        </div>
      </div>

      <div className="flex justify-between items-center mb-1">
        <span className="text-gray-500 text-sm font-mono">{invoiceNumber}</span>
        <span className="text-white font-black text-2xl">{fmtNum(grandTotal)}</span>
      </div>

      {jobClient && (
        <p className="text-gray-400 text-sm mb-3">{jobClient.name}{jobClient.company ? ` · ${jobClient.company}` : ""}</p>
      )}

      <div className="flex items-center gap-3 mb-4">
        <span className="text-gray-500 text-xs">{termsLabel(invoice.payment_terms)}</span>
        {invDue && (
          <span className={`text-xs font-semibold ${overdue ? "text-red-400" : "text-gray-400"}`}>Due {invDue}</span>
        )}
      </div>

      {/* Internal breakdown */}
      {renderInternalBreakdown()}

      {/* Status selector */}
      <div className="flex gap-2 mb-4">
        {(["unpaid", "sent", "paid"] as InvoiceStatus[]).map((s) => {
          const c = STATUS_CONFIG[s];
          const active = invoice.status === s;
          return (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              disabled={isPending}
              className={`flex-1 py-3 rounded-xl font-semibold text-sm border transition-colors active:scale-95 disabled:opacity-60 ${active ? `${c.bg} ${c.color}` : "bg-[#242424] text-gray-400 border-[#2a2a2a]"}`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {invoice.status !== "paid" && (
        <button
          onClick={() => handleStatusChange("paid")}
          disabled={isPending}
          className="w-full mb-3 bg-green-600 text-white font-bold text-base py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
        >
          Record Payment
        </button>
      )}

      {invoice.sent_at && <p className="text-gray-500 text-xs mb-1">Sent {fmtDate(invoice.sent_at)}</p>}
      {invoice.paid_at && <p className="text-green-400 text-xs font-semibold mb-1">Paid {fmtDate(invoice.paid_at)}</p>}

      {/* Payment Schedule (collapsible) */}
      <div className="mt-4 pt-4 border-t border-[#2a2a2a]">
        <button
          onClick={() => setEditingSchedule((v) => !v)}
          className="w-full flex items-center justify-between mb-3 active:opacity-70"
        >
          <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Payment Schedule</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`text-gray-500 transition-transform ${editingSchedule ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9"/></svg>
        </button>

        {editingSchedule ? (
          <>
            {renderPaymentSchedule()}
            <div className="flex gap-2 mt-1 mb-4">
              <button onClick={handleSaveSchedule} className="flex-1 bg-orange-500 text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-transform">Save Schedule</button>
              <button onClick={cancelScheduleEdit} className="flex-1 bg-[#242424] border border-[#2a2a2a] text-gray-400 font-semibold py-3 rounded-xl text-sm active:scale-95 transition-transform">Cancel</button>
            </div>
          </>
        ) : (
          <div className="mb-1">
            {liveMilestones.length > 0 ? (
              liveMilestones.map((m, i) => (
                <div key={i} className="flex justify-between text-sm py-1">
                  <span className={m.status === "paid" ? "text-green-400" : "text-gray-400"}>{m.label}</span>
                  <span className={`font-mono ${m.status === "paid" ? "text-green-400" : "text-gray-300"}`}>{fmtNum(m.amount)}</span>
                </div>
              ))
            ) : (
              <p className="text-gray-600 text-xs mb-2">Full payment — no splits.</p>
            )}
          </div>
        )}
      </div>

      {/* Client Display Settings (collapsible) */}
      <div className="mt-4 pt-4 border-t border-[#2a2a2a]">
        <button
          onClick={() => setEditingDisplay((v) => !v)}
          className="w-full flex items-center justify-between mb-3 active:opacity-70"
        >
          <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Client Display Settings</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`text-gray-500 transition-transform ${editingDisplay ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9"/></svg>
        </button>

        {editingDisplay ? (
          <>
            {renderDisplaySettings()}
            {renderClientLineItems()}
            <div className="flex gap-2 mt-1 mb-4">
              <button onClick={handleSaveDisplaySettings} className="flex-1 bg-orange-500 text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-transform">Save Settings</button>
              <button onClick={() => cancelDisplayEdit(invoice)} className="flex-1 bg-[#242424] border border-[#2a2a2a] text-gray-400 font-semibold py-3 rounded-xl text-sm active:scale-95 transition-transform">Cancel</button>
            </div>
          </>
        ) : (
          <div className="mb-1">
            {invoice.client_line_items?.length > 0 ? (
              invoice.client_line_items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm py-1">
                  <span className="text-gray-400">{item.name}</span>
                  <span className="text-gray-300 font-mono">{fmtNum(item.amount)}</span>
                </div>
              ))
            ) : (
              <p className="text-gray-600 text-xs mb-2">No client line items set.</p>
            )}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
        {editingNotes ? (
          <>
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={3}
              className="w-full bg-[#242424] border border-[#2a2a2a] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 resize-none mb-2"
            />
            <div className="flex gap-2">
              <button onClick={handleSaveNotes} className="flex-1 bg-orange-500 text-white font-bold py-3 rounded-xl text-sm active:scale-95">Save</button>
              <button onClick={() => { setNotesDraft(invoice.notes ?? ""); setEditingNotes(false); }} className="flex-1 bg-[#242424] border border-[#2a2a2a] text-gray-400 font-semibold py-3 rounded-xl text-sm active:scale-95">Cancel</button>
            </div>
          </>
        ) : (
          <button onClick={() => { setNotesDraft(invoice.notes ?? ""); setEditingNotes(true); }} className="text-gray-500 text-xs active:opacity-70">
            {invoice.notes ? `📝 ${invoice.notes.slice(0, 60)}${invoice.notes.length > 60 ? "…" : ""}` : "+ Add notes to invoice"}
          </button>
        )}
      </div>

      {/* Share + PDF */}
      <button onClick={handleShareLink} className="w-full mt-4 flex items-center justify-center gap-2 bg-orange-500/10 border border-orange-500/30 text-orange-400 font-semibold text-sm py-3.5 rounded-xl active:scale-95 transition-transform">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        {copied ? "Link Copied!" : "Share Payment Link"}
      </button>

      <button onClick={handleDownloadPDF} disabled={pdfLoading} className="w-full mt-2 flex items-center justify-center gap-2 bg-[#242424] border border-[#2a2a2a] text-white font-semibold text-sm py-3.5 rounded-xl active:scale-95 transition-transform disabled:opacity-50">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        {pdfLoading ? "Building PDF…" : "Download Invoice PDF"}
      </button>
    </div>
  );
}
