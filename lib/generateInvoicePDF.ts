import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

// ─── Interfaces ────────────────────────────────────────────────────────────

export interface BusinessProfileData {
  business_name?: string | null;
  owner_name?: string | null;
  license_number?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface ClientData {
  name: string;
  company?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface InvoicePDFData {
  contractorEmail: string;
  jobName: string;
  jobAddress: string;
  date: string;
  invoiceNumber: string;
  invoiceId?: string;
  materialsTotal: number;
  laborTotal: number;
  addons: { name: string; amount: number }[];
  grandTotal: number;
  businessProfile?: BusinessProfileData | null;
  logoUrl?: string | null;
  client?: ClientData | null;
  paymentTermsLabel?: string;
  dueDate?: string | null;
  notes?: string | null;
  status?: "unpaid" | "sent" | "paid";
  paidDate?: string | null;
}

// ─── Colors ─────────────────────────────────────────────────────────────────

const ORANGE   = rgb(0.976, 0.451, 0.086);
const BLACK    = rgb(0.08,  0.08,  0.08);
const GRAY     = rgb(0.48,  0.48,  0.48);
const LGRAY    = rgb(0.80,  0.80,  0.80);
const ALT_ROW  = rgb(0.967, 0.967, 0.967);
const ORANGE_BG = rgb(1.0,  0.96,  0.91);
const RED_BG   = rgb(1.0,   0.92,  0.92);
const RED_TEXT = rgb(0.75,  0.10,  0.10);
const GREEN_BG = rgb(0.90,  1.0,   0.92);
const GREEN_TEXT = rgb(0.08, 0.55,  0.18);
const YEL_BG   = rgb(1.0,   0.97,  0.88);
const YEL_TEXT = rgb(0.65,  0.45,  0.02);

// ─── Layout ──────────────────────────────────────────────────────────────────

const PW = 612;
const PH = 792;
const M  = 54;
const RX = PW - M;   // 558
const CW = RX - M;   // 504

// 2-column invoice table: Description | Amount
const TC_D   = M;        // description left
const TC_A_R = RX;       // amount right-align x

const ROW_H = 20;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTotal(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

function fmtSigned(n: number): string {
  return (n < 0 ? "−$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-US");
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function generateAndDownloadInvoicePDF(data: InvoicePDFData): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const bold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const reg    = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page   = pdfDoc.addPage([PW, PH]);

  let y = PH;

  function tr(text: string, rightX: number, yy: number, font: typeof bold, size: number, color: typeof BLACK) {
    const w = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: rightX - w, y: yy, font, size, color });
  }

  function clip(text: string, font: typeof bold, size: number, maxW: number): string {
    if (font.widthOfTextAtSize(text, size) <= maxW) return text;
    let t = text;
    while (t.length > 3 && font.widthOfTextAtSize(t + "…", size) > maxW) t = t.slice(0, -1);
    return t + "…";
  }

  function hLine(yy: number, thick = 0.5, color = LGRAY) {
    page.drawLine({ start: { x: M, y: yy }, end: { x: RX, y: yy }, thickness: thick, color });
  }

  function pill(
    text: string, px: number, py: number,
    bgColor: typeof ORANGE_BG, textColor: typeof ORANGE,
    font: typeof bold, size: number
  ) {
    const tw  = font.widthOfTextAtSize(text, size);
    const ph  = size + 8;
    const pw2 = tw + 16;
    page.drawRectangle({ x: px, y: py - 3, width: pw2, height: ph, color: bgColor });
    page.drawText(text, { x: px + 8, y: py, font, size, color: textColor });
    return pw2;
  }

  // ── Orange top accent bar ──────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: PH - 5, width: PW, height: 5, color: ORANGE });
  y = PH - 5;

  // ── Header: logo left, business info right ────────────────────────────────
  const LOGO_TOP   = y - 14;
  const LOGO_MAX_H = 80;
  const LOGO_MAX_W = 190;
  const bp = data.businessProfile;

  let logoEmbedded = false;
  if (data.logoUrl) {
    try {
      const resp  = await fetch(data.logoUrl);
      const buf   = await resp.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
      const img   = isPng ? await pdfDoc.embedPng(buf) : await pdfDoc.embedJpg(buf);
      const scale = Math.min(LOGO_MAX_H / img.height, LOGO_MAX_W / img.width);
      const lW = img.width * scale;
      const lH = img.height * scale;
      page.drawImage(img, { x: M, y: LOGO_TOP - lH, width: lW, height: lH });
      logoEmbedded = true;
    } catch { /* fall through */ }
  }

  if (!logoEmbedded) {
    const bizName = (bp?.business_name ?? "Your Business").toUpperCase();
    page.drawText(bizName, { x: M, y: LOGO_TOP - 30, font: bold, size: 24, color: ORANGE });
    if (bp?.license_number) {
      page.drawText(`License # ${bp.license_number}`, { x: M, y: LOGO_TOP - 50, font: reg, size: 9, color: GRAY });
    }
  }

  // Right: business info
  let bry = LOGO_TOP - 16;
  if (bp?.business_name) {
    tr(bp.business_name, RX, bry, bold, 14, BLACK);
    bry -= 17;
  }
  if (bp?.license_number) {
    tr(`License # ${bp.license_number}`, RX, bry, reg, 9, GRAY);
    bry -= 13;
  }
  if (bp?.address) {
    tr(bp.address, RX, bry, reg, 9, GRAY);
    bry -= 13;
  }
  const contactLine = [bp?.phone, bp?.email ?? data.contractorEmail].filter(Boolean).join("  ·  ");
  if (contactLine) tr(contactLine, RX, bry, reg, 9, GRAY);

  y = LOGO_TOP - LOGO_MAX_H - 18;

  hLine(y);
  y -= 1;

  // ── Document title block ──────────────────────────────────────────────────
  y -= 20;
  page.drawText("INVOICE", { x: M, y, font: bold, size: 28, color: ORANGE });

  // Number + dates stacked right
  tr(data.invoiceNumber, RX, y + 12, bold, 10, BLACK);
  tr(`Issued: ${data.date}`, RX, y - 2, reg, 9, GRAY);
  if (data.dueDate) {
    const isOverdue = data.status !== "paid" && isDatePast(data.dueDate);
    tr(`Due: ${data.dueDate}`, RX, y - 15, reg, 9, isOverdue ? RED_TEXT : GRAY);
  }
  if (data.paymentTermsLabel) {
    tr(data.paymentTermsLabel, RX, y - 28, reg, 9, GRAY);
  }

  y -= 18;

  // Overdue badge (if applicable)
  if (data.status !== "paid" && data.dueDate && isDatePast(data.dueDate)) {
    y -= 14;
    pill("⚠  OVERDUE", M, y, RED_BG, RED_TEXT, bold, 9);
    y -= 6;
  }

  y -= 18;
  hLine(y);
  y -= 1;

  // ── Client + Job info ─────────────────────────────────────────────────────
  const COL2      = M + Math.round(CW * 0.48);
  const BLOCK_TOP = y - 14;

  // Left: BILL TO
  page.drawText("BILL TO", { x: M, y: BLOCK_TOP, font: bold, size: 8, color: GRAY });
  let ly = BLOCK_TOP - 16;
  if (data.client) {
    page.drawText(clip(data.client.name, bold, 12, COL2 - M - 8), { x: M, y: ly, font: bold, size: 12, color: BLACK }); ly -= 16;
    if (data.client.company) { page.drawText(data.client.company, { x: M, y: ly, font: reg, size: 9.5, color: GRAY }); ly -= 13; }
    if (data.client.address) { page.drawText(clip(data.client.address, reg, 9, COL2 - M - 8), { x: M, y: ly, font: reg, size: 9, color: GRAY }); ly -= 13; }
    if (data.client.phone)   { page.drawText(data.client.phone, { x: M, y: ly, font: reg, size: 9, color: GRAY }); ly -= 13; }
    if (data.client.email)   { page.drawText(data.client.email, { x: M, y: ly, font: reg, size: 9, color: GRAY }); ly -= 13; }
  } else {
    page.drawText("No client linked", { x: M, y: ly, font: reg, size: 9.5, color: GRAY }); ly -= 13;
  }

  // Right: JOB
  page.drawText("JOB", { x: COL2, y: BLOCK_TOP, font: bold, size: 8, color: GRAY });
  let ry2 = BLOCK_TOP - 16;
  const maxJobW = RX - COL2;
  page.drawText(clip(data.jobName, bold, 12, maxJobW), { x: COL2, y: ry2, font: bold, size: 12, color: BLACK }); ry2 -= 16;
  if (data.jobAddress) {
    page.drawText(clip(data.jobAddress, reg, 9, maxJobW), { x: COL2, y: ry2, font: reg, size: 9, color: GRAY }); ry2 -= 13;
  }

  y = Math.min(ly, ry2) - 14;
  hLine(y);
  y -= 1;

  // ── Line items table ──────────────────────────────────────────────────────
  y -= 16;

  // Header row
  page.drawRectangle({ x: M, y: y - 5, width: CW, height: 20, color: ALT_ROW });
  page.drawText("DESCRIPTION", { x: TC_D + 2, y, font: bold, size: 7.5, color: GRAY });
  tr("AMOUNT", TC_A_R - 2, y, bold, 7.5, GRAY);
  y -= 6;
  hLine(y, 0.75, BLACK);
  y -= 10;

  let rowIdx = 0;

  function drawInvRow(desc: string, amount: string, amtColor = BLACK as typeof BLACK) {
    if (rowIdx % 2 === 1) {
      page.drawRectangle({ x: M, y: y - 5, width: CW, height: ROW_H, color: ALT_ROW });
    }
    page.drawText(clip(desc, reg, 9.5, CW - 120), { x: TC_D + 2, y, font: reg, size: 9.5, color: BLACK });
    tr(amount, TC_A_R - 2, y, bold, 9.5, amtColor);
    y -= ROW_H;
    rowIdx++;
  }

  drawInvRow("Materials",    fmtTotal(data.materialsTotal));
  drawInvRow("Labor",        fmtTotal(data.laborTotal));

  const validAddons = data.addons.filter((a) => a.name && a.amount !== 0);
  if (validAddons.length > 0) {
    y -= 4;
    hLine(y, 0.4);
    y -= 14;
    page.drawText("CHANGE ORDERS / ADD-ONS", { x: TC_D + 2, y, font: bold, size: 7.5, color: GRAY });
    y -= 16;
    for (const addon of validAddons) {
      drawInvRow(addon.name, fmtSigned(addon.amount), addon.amount < 0 ? GRAY : BLACK);
    }
  }

  y -= 4;
  hLine(y, 1.5, BLACK);
  y -= 30;

  // Total
  page.drawText("TOTAL DUE", { x: M, y: y + 6, font: bold, size: 16, color: BLACK });
  tr(fmtTotal(data.grandTotal), RX - 2, y, bold, 30, ORANGE);
  y -= 42;

  // ── Payment status badge ──────────────────────────────────────────────────
  if (data.status) {
    let bgC = RED_BG, txC = RED_TEXT, label = "UNPAID";
    if (data.status === "paid") {
      bgC = GREEN_BG; txC = GREEN_TEXT;
      label = data.paidDate ? `PAID  ${data.paidDate}` : "PAID";
    } else if (data.status === "sent") {
      bgC = YEL_BG; txC = YEL_TEXT; label = "SENT";
    }
    pill(label, M, y, bgC, txC, bold, 10);
    y -= 22;
  }

  // Pay online link (if unpaid/sent)
  if (data.invoiceId && data.status !== "paid") {
    y -= 4;
    const payUrl = `sightline.one/pay/${data.invoiceId}`;
    page.drawText("Pay online at:", { x: M, y, font: reg, size: 9, color: GRAY });
    page.drawText(payUrl, { x: M + 78, y, font: bold, size: 9, color: ORANGE });
    y -= 18;
  }

  // Payment terms reminder
  if (data.paymentTermsLabel) {
    y -= 4;
    const termsLine = data.dueDate
      ? `Payment terms: ${data.paymentTermsLabel}  ·  Due ${data.dueDate}`
      : `Payment terms: ${data.paymentTermsLabel}`;
    page.drawText(termsLine, { x: M, y, font: reg, size: 9, color: GRAY });
    y -= 18;
  } else {
    page.drawText("Please remit payment upon receipt. Thank you for your business.", { x: M, y, font: reg, size: 9, color: GRAY });
    y -= 18;
  }

  // ── Notes ────────────────────────────────────────────────────────────────
  if (data.notes && data.notes.trim()) {
    y -= 6;
    hLine(y, 0.4);
    y -= 16;
    page.drawText("NOTES", { x: M, y, font: bold, size: 8, color: GRAY });
    y -= 14;
    const words = data.notes.trim().split(/\s+/);
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (reg.widthOfTextAtSize(test, 9.5) > CW) {
        page.drawText(line, { x: M, y, font: reg, size: 9.5, color: BLACK });
        y -= 14;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) {
      page.drawText(line, { x: M, y, font: reg, size: 9.5, color: BLACK });
      y -= 14;
    }
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const FY = 30;
  hLine(FY + 16, 0.4);
  const footParts: string[] = [];
  if (bp?.business_name)  footParts.push(`Invoice prepared by ${bp.business_name}`);
  if (bp?.license_number) footParts.push(`License # ${bp.license_number}`);
  if (bp?.phone)          footParts.push(bp.phone);
  const fEmail = bp?.email ?? data.contractorEmail;
  if (fEmail) footParts.push(fEmail);
  const footText = footParts.length ? footParts.join("  ·  ") : "Generated by Sightline · sightline.one";
  const fw = reg.widthOfTextAtSize(footText, 7.5);
  page.drawText(footText, { x: PW / 2 - fw / 2, y: FY, font: reg, size: 7.5, color: GRAY });

  // ── Download ──────────────────────────────────────────────────────────────
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `invoice-${data.jobName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function isDatePast(dueDateStr: string): boolean {
  // dueDateStr is a display string like "April 15, 2026"
  // We just check if today > due date
  try {
    return new Date() > new Date(dueDateStr);
  } catch {
    return false;
  }
}
