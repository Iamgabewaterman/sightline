import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
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
  includeWatermark?: boolean;
  totalRows?: number;
}

// ── Colors ───────────────────────────────────────────────────────────────────

const ORANGE = rgb(0.976, 0.451, 0.086);
const BLACK  = rgb(0.08,  0.08,  0.08);
const GRAY   = rgb(0.50,  0.50,  0.50);
const LGRAY  = rgb(0.85,  0.85,  0.85);
const ALT    = rgb(0.97,  0.97,  0.97);
const WHITE  = rgb(1,     1,     1);
const WMARK  = rgb(0.88,  0.88,  0.88);

// ── Layout constants (landscape letter) ──────────────────────────────────────

const PW = 792;
const PH = 612;
const M  = 40;
const CW = PW - 2 * M; // 712

const COL_ROW_H  = 20;
const DATA_ROW_H = 15;
const FOOTER_Y   = 22;
const MIN_Y      = FOOTER_Y + COL_ROW_H + 10;

// ── Natural column widths ─────────────────────────────────────────────────────

const NAT_W: Record<string, number> = {
  // shared
  job_name:        110,  job_number:       50,   client_name:      80,
  job_types:       80,   status:           55,

  // job_profitability
  start_date:      62,   completion_date:  62,   contract_amount:  72,
  materials_cost:  72,   labor_cost:       70,   gross_profit:     70,
  margin_pct:      52,   invoice_status:   62,   amount_collected: 72,
  balance_outstanding: 75,

  // materials_cost
  date_purchased:  62,   material_name:    110,  brand:            65,
  spec:            75,   category:         62,   quantity:         44,
  unit:            38,   unit_cost:        60,   total_cost:       62,
  vendor:          75,   receipt_attached: 44,

  // labor
  work_date:       62,   crew_member:      90,   trade:            60,
  hours:           42,   hourly_rate:      58,   notes:            90,

  // tax_summary
  schedule_c_line: 110,  description:      280,  amount:           80,

  // invoices_payments
  invoice_number:  70,   invoice_date:     62,   due_date:         62,
  amount_invoiced: 72,   amount_paid:      70,   payment_date:     62,
  days_outstanding: 55,

  // mileage
  log_date:        62,   purpose:          120,  miles:            44,
  irs_rate:        52,   deduction:        62,

  // waste_variance
  baseline_qty:    55,   actual_qty:       55,   qty_variance:     55,
  baseline_cost:   65,   actual_cost:      65,   cost_variance:    65,
  disposition:     70,

  // legacy keys
  name: 110, address: 100, client: 80, total_days: 42, calculated_sqft: 55,
  crew_name: 100, rate: 52, created_at: 62, quote_amount: 68,
  material_budget: 68, labor_budget: 68, actual_materials: 68, actual_labor: 68,
  total_actual: 68, profit: 65, payment_terms: 80, sent_at: 62, paid_at: 62,
  total_amount: 68,
};

function colWidths(cols: ColumnDef[]): number[] {
  const raw   = cols.map(c => NAT_W[c.key] ?? 80);
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
  let pageCount = 0;

  function newPage() {
    curPage = pdfDoc.addPage([PW, PH]);
    y = PH - M;
    pageCount++;
  }

  function clip(text: string, font: typeof bold, size: number, maxW: number): string {
    const s = String(text ?? "—");
    if (font.widthOfTextAtSize(s, size) <= maxW) return s;
    let t = s;
    while (t.length > 1 && font.widthOfTextAtSize(t + "…", size) > maxW) t = t.slice(0, -1);
    return t + "…";
  }

  // ── Page header ───────────────────────────────────────────────────────────
  function drawPageHeader() {
    const isFirst = pageCount === 1;

    // Orange top stripe
    curPage.drawRectangle({ x: 0, y: PH - 4, width: PW, height: 4, color: ORANGE });
    y = PH - 4 - 14;

    if (isFirst) {
      // ── Full cover section on first page ──────────────────────────────────
      if (logoImg) {
        const maxH = 40, maxW = 130;
        const scale = Math.min(maxH / logoImg.height, maxW / logoImg.width);
        const imgW  = logoImg.width  * scale;
        const imgH  = logoImg.height * scale;
        curPage.drawImage(logoImg, { x: M, y: y - imgH, width: imgW, height: imgH });
        y -= imgH + 4;
      } else {
        const biz = data.businessProfile?.business_name ?? "Sightline";
        curPage.drawText(biz, { x: M, y, font: bold, size: 14, color: ORANGE });
        y -= 5;
      }

      // License number top-right
      const lic = data.businessProfile?.license_number;
      if (lic) {
        const licText = `License #${lic}`;
        const tw = reg.widthOfTextAtSize(licText, 9);
        curPage.drawText(licText, { x: PW - M - tw, y: PH - 18, font: reg, size: 9, color: GRAY });
      }

      y -= 14;

      // Report title — large
      curPage.drawText(data.reportTitle, { x: M, y, font: bold, size: 15, color: BLACK });
      y -= 17;

      // Date range
      curPage.drawText(`Date Range: ${data.dateRangeLabel}`, { x: M, y, font: reg, size: 9, color: GRAY });
      const rowLabel = data.totalRows != null ? `${data.totalRows} row${data.totalRows !== 1 ? "s" : ""}` : "";
      if (rowLabel) {
        const tw = reg.widthOfTextAtSize(rowLabel, 9);
        curPage.drawText(rowLabel, { x: PW - M - tw, y, font: reg, size: 9, color: GRAY });
      }
      y -= 12;

      // Generated date
      curPage.drawText(`Prepared ${data.generatedDate}`, { x: M, y, font: reg, size: 8, color: GRAY });
      y -= 14;

      // Separator
      curPage.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 0.5, color: LGRAY });
      y -= 10;

    } else {
      // ── Compact continuation header ───────────────────────────────────────
      const biz = data.businessProfile?.business_name ?? "Sightline";
      curPage.drawText(biz, { x: M, y, font: bold, size: 9, color: ORANGE });

      const tw = bold.widthOfTextAtSize(data.reportTitle, 9);
      curPage.drawText(clip(data.reportTitle, bold, 9, CW - 80), { x: PW - M - Math.min(tw, CW - 80), y, font: bold, size: 9, color: BLACK });

      y -= 13;
      curPage.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 0.3, color: LGRAY });
      y -= 8;
    }
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
      const val  = row[col.key];
      const text = val == null ? "—" : String(val);
      const c    = clip(text, reg, 8, widths[i] - 6);

      // Red for negative/loss values
      const isNeg = text.startsWith("(") && text.endsWith(")");
      curPage.drawText(c, { x, y: y - 11, font: reg, size: 8, color: isNeg ? rgb(0.8, 0.1, 0.1) : BLACK });
      x += widths[i];
    });
    y -= DATA_ROW_H;
  }

  // ── Ensure space ──────────────────────────────────────────────────────────
  function ensureSpace(needed: number, cols: ColumnDef[], widths: number[]) {
    if (y - needed < MIN_Y) {
      newPage();
      drawPageHeader();
      drawColHeader(cols, widths);
    }
  }

  // ── Render one section ────────────────────────────────────────────────────
  function renderSection(section: ReportPDFSection) {
    const widths = colWidths(section.columns);

    if (section.title) {
      if (y - 30 < MIN_Y) { newPage(); drawPageHeader(); }
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
        drawPageHeader();
      }
      renderSection(section);
    });
  } else {
    renderSection({ columns: data.columns, rows: data.rows });
  }

  // ── Footers + watermarks ───────────────────────────────────────────────────
  const allPages = pdfDoc.getPages();
  const total    = allPages.length;
  const lic      = data.businessProfile?.license_number;

  allPages.forEach((pg, idx) => {
    // Watermark diagonal
    if (data.includeWatermark) {
      pg.drawText("CONFIDENTIAL", {
        x: 175,
        y: 155,
        font: bold,
        size: 60,
        color: WMARK,
        rotate: degrees(35),
        opacity: 0.08,
      });
    }

    // Footer rule
    pg.drawLine({ start: { x: M, y: FOOTER_Y + 8 }, end: { x: PW - M, y: FOOTER_Y + 8 }, thickness: 0.3, color: LGRAY });

    // Footer left: Sightline + license number
    const footerLeft = lic ? `Sightline  ·  License #${lic}` : "Sightline";
    pg.drawText(footerLeft, { x: M, y: FOOTER_Y - 4, font: reg, size: 7.5, color: GRAY });

    // Footer right: page X of Y
    const label = `Page ${idx + 1} of ${total}`;
    const tw    = reg.widthOfTextAtSize(label, 7.5);
    pg.drawText(label, { x: PW - M - tw, y: FOOTER_Y - 4, font: reg, size: 7.5, color: GRAY });
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
