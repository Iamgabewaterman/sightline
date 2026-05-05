import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { ColumnDef } from "@/app/(dashboard)/reports/types";
import type { BusinessProfileData } from "./generateInvoicePDF";

export interface ReportPDFSection {
  title?: string;
  columns: ColumnDef[];
  rows: Record<string, unknown>[];
}

export interface ReportPDFData {
  reportTitle: string;
  dateRangeLabel: string;
  generatedDate: string;
  businessProfile?: BusinessProfileData | null;
  logoUrl?: string | null;
  columns: ColumnDef[];
  rows: Record<string, unknown>[];
  sections?: ReportPDFSection[];
}

// ── Colors ───────────────────────────────────────────────────────────────────

const ORANGE = rgb(0.976, 0.451, 0.086);
const BLACK  = rgb(0.08,  0.08,  0.08);
const GRAY   = rgb(0.50,  0.50,  0.50);
const LGRAY  = rgb(0.85,  0.85,  0.85);
const ALT    = rgb(0.97,  0.97,  0.97);
const WHITE  = rgb(1,     1,     1);

// ── Layout constants (landscape letter) ──────────────────────────────────────

const PW = 792;
const PH = 612;
const M  = 40;
const CW = PW - 2 * M; // 712

const COL_ROW_H  = 20;
const DATA_ROW_H = 15;
const FOOTER_Y   = 22;
const MIN_Y      = FOOTER_Y + COL_ROW_H + 10;

// ── Natural column widths ────────────────────────────────────────────────────

const NAT_W: Record<string, number> = {
  job_name: 110, job_number: 52, types: 80, status: 60, address: 100, client: 80,
  start_date: 62, completed_date: 62, total_days: 42, calculated_sqft: 55,
  name: 110, category: 65, trade: 65, quantity_ordered: 52, quantity_used: 52,
  unit: 38, unit_cost: 58, total_cost: 60, created_at: 62, notes: 100,
  crew_name: 100, hours: 40, rate: 52,
  quote_amount: 68, material_budget: 68, labor_budget: 68,
  actual_materials: 68, actual_labor: 68, total_actual: 68, profit: 65, margin_pct: 52,
  invoice_number: 65, payment_terms: 80, sent_at: 62, paid_at: 62, due_date: 62,
  total_amount: 68, log_date: 62, description: 110, miles: 44, deduction: 62,
};

function colWidths(cols: ColumnDef[]): number[] {
  const raw = cols.map(c => NAT_W[c.key] ?? 80);
  const total = raw.reduce((s, w) => s + w, 0);
  const scale = total > CW ? CW / total : 1;
  return raw.map(w => Math.floor(w * scale));
}

export async function generateAndDownloadReportPDF(data: ReportPDFData): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const bold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const reg    = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Try to embed logo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let logoImg: any = null;
  if (data.logoUrl) {
    try {
      const resp  = await fetch(data.logoUrl);
      const buf   = await resp.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
      logoImg = isPng ? await pdfDoc.embedPng(buf) : await pdfDoc.embedJpg(buf);
    } catch { /* skip logo on error */ }
  }

  // ── Mutable state ──────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let curPage: any = null;
  let y = 0;

  function newPage() {
    curPage = pdfDoc.addPage([PW, PH]);
    y = PH - M;
  }

  function clip(text: string, font: typeof bold, size: number, maxW: number): string {
    const s = String(text ?? "—");
    if (font.widthOfTextAtSize(s, size) <= maxW) return s;
    let t = s;
    while (t.length > 1 && font.widthOfTextAtSize(t + "…", size) > maxW) t = t.slice(0, -1);
    return t + "…";
  }

  // ── Page header (first page only) ─────────────────────────────────────────
  function drawPageHeader() {
    curPage.drawRectangle({ x: 0, y: PH - 4, width: PW, height: 4, color: ORANGE });
    y = PH - 4 - 14;

    if (logoImg) {
      const maxH = 48, maxW = 140;
      const scale = Math.min(maxH / logoImg.height, maxW / logoImg.width);
      const imgW  = logoImg.width * scale;
      const imgH  = logoImg.height * scale;
      curPage.drawImage(logoImg, { x: M, y: y - imgH, width: imgW, height: imgH });
      y -= imgH + 6;
    } else {
      const biz = data.businessProfile?.business_name ?? "Sightline";
      curPage.drawText(biz, { x: M, y, font: bold, size: 15, color: ORANGE });
      y -= 20;
    }

    curPage.drawText(data.reportTitle, { x: M, y, font: bold, size: 12, color: BLACK });
    y -= 16;

    const meta = `${data.dateRangeLabel}  ·  Generated ${data.generatedDate}`;
    curPage.drawText(meta, { x: M, y, font: reg, size: 9, color: GRAY });
    y -= 16;

    curPage.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 0.5, color: LGRAY });
    y -= 10;
  }

  // ── Table column header row ────────────────────────────────────────────────
  function drawColHeader(cols: ColumnDef[], widths: number[]) {
    curPage.drawRectangle({ x: M, y: y - COL_ROW_H + 4, width: CW, height: COL_ROW_H, color: ORANGE });
    let x = M + 4;
    cols.forEach((col, i) => {
      const text = clip(col.label, bold, 7.5, widths[i] - 6);
      curPage.drawText(text, { x, y: y - 14, font: bold, size: 7.5, color: WHITE });
      x += widths[i];
    });
    y -= COL_ROW_H;
  }

  // ── Data row ───────────────────────────────────────────────────────────────
  function drawDataRow(row: Record<string, unknown>, cols: ColumnDef[], widths: number[], alt: boolean) {
    if (alt) {
      curPage.drawRectangle({ x: M, y: y - DATA_ROW_H + 2, width: CW, height: DATA_ROW_H, color: ALT });
    }
    let x = M + 4;
    cols.forEach((col, i) => {
      const val = row[col.key];
      const text = val == null ? "—" : String(val);
      const c = clip(text, reg, 8, widths[i] - 6);
      curPage.drawText(c, { x, y: y - 11, font: reg, size: 8, color: BLACK });
      x += widths[i];
    });
    y -= DATA_ROW_H;
  }

  // ── Section break helper ───────────────────────────────────────────────────
  function ensureSpace(needed: number, cols: ColumnDef[], widths: number[]) {
    if (y - needed < MIN_Y) {
      newPage();
      drawColHeader(cols, widths);
    }
  }

  // ── Render one section (or the whole report if no sections) ───────────────
  function renderSection(section: ReportPDFSection) {
    const widths = colWidths(section.columns);

    if (section.title) {
      if (y - 30 < MIN_Y) { newPage(); }
      curPage.drawText(section.title, { x: M, y, font: bold, size: 11, color: ORANGE });
      y -= 15;
    }

    drawColHeader(section.columns, widths);

    if (section.rows.length === 0) {
      curPage.drawText("No data for this period.", { x: M + 4, y: y - 11, font: reg, size: 9, color: GRAY });
      y -= DATA_ROW_H + 4;
    } else {
      section.rows.forEach((row, i) => {
        ensureSpace(DATA_ROW_H, section.columns, widths);
        drawDataRow(row, section.columns, widths, i % 2 === 1);
      });
    }
    y -= 14;
  }

  // ── Build pages ────────────────────────────────────────────────────────────
  newPage();
  drawPageHeader();

  if (data.sections && data.sections.length > 0) {
    data.sections.forEach((section, i) => {
      if (i > 0) {
        newPage();
      }
      renderSection(section);
    });
  } else {
    renderSection({ columns: data.columns, rows: data.rows });
  }

  // ── Footers (drawn after all pages are known) ──────────────────────────────
  const allPages = pdfDoc.getPages();
  const total    = allPages.length;
  allPages.forEach((pg, idx) => {
    pg.drawLine({ start: { x: M, y: FOOTER_Y + 8 }, end: { x: PW - M, y: FOOTER_Y + 8 }, thickness: 0.3, color: LGRAY });
    pg.drawText("Sightline", { x: M, y: FOOTER_Y - 4, font: reg, size: 8, color: GRAY });
    const label = `Page ${idx + 1} of ${total}`;
    const tw    = reg.widthOfTextAtSize(label, 8);
    pg.drawText(label, { x: PW - M - tw, y: FOOTER_Y - 4, font: reg, size: 8, color: GRAY });
  });

  // ── Download ───────────────────────────────────────────────────────────────
  const bytes = await pdfDoc.save();
  const blob  = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement("a");
  a.href      = url;
  a.download  = `${data.reportTitle.replace(/\s+/g, "-").toLowerCase()}-${data.generatedDate}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
