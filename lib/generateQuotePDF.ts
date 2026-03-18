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

export interface QuoteLineItem {
  description: string;
  qty: number;
  unit: string;
  unitCost: number;
  total: number;
}

export interface QuoteLaborItem {
  description: string;
  hours: number;
  rate: number;
  total: number;
}

export interface QuotePDFData {
  contractorEmail: string;
  jobName: string;
  jobAddress: string;
  jobTypes?: string[];
  date: string;
  quoteNumber?: string;
  materialsTotal: number;
  laborTotal: number;
  addons: { name: string; amount: number }[];
  profitMarginPct: number;
  profitAmount: number;
  grandTotal: number;
  businessProfile?: BusinessProfileData | null;
  logoUrl?: string | null;
  client?: {
    name: string;
    company?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  lineItems?: QuoteLineItem[];
  laborItems?: QuoteLaborItem[];
  // Signature fields (for signed/accepted quotes)
  signatureData?: string | null;
  signedByName?: string | null;
  signedAt?: string | null;
}

// ─── Colors ─────────────────────────────────────────────────────────────────

const ORANGE  = rgb(0.976, 0.451, 0.086);
const BLACK   = rgb(0.08,  0.08,  0.08);
const GRAY    = rgb(0.48,  0.48,  0.48);
const LGRAY   = rgb(0.80,  0.80,  0.80);
const ALT_ROW = rgb(0.967, 0.967, 0.967);
const ORANGE_BG = rgb(1.0,  0.96,  0.91);

// ─── Layout constants ────────────────────────────────────────────────────────

const PW = 612;   // US Letter width
const PH = 792;   // US Letter height
const M  = 54;    // margin (0.75 inch)
const RX = PW - M;        // right content edge = 558
const CW = RX - M;        // content width = 504

// 5-column table: Description | Qty | Unit | Unit Cost | Total
const TC_D   = M;           // description left
const TC_Q_R = M + 220;     // qty right-align x
const TC_U   = M + 228;     // unit left
const TC_C_R = M + 422;     // unit cost right-align x
const TC_T_R = RX;          // total right-align x (= 558)

const ROW_H = 20;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  return "$" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function fmtTotal(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function generateAndDownloadQuotePDF(data: QuotePDFData): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const bold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const reg    = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page   = pdfDoc.addPage([PW, PH]);

  let y = PH;

  // ── helpers captured over page / fonts ──
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

  // ── Orange top accent bar ──────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: PH - 5, width: PW, height: 5, color: ORANGE });
  y = PH - 5;

  // ── Header: logo left, business info right ────────────────────────────────
  const LOGO_TOP  = y - 14;   // top of the logo/name area
  const LOGO_MAX_H = 80;
  const LOGO_MAX_W = 190;
  const bp = data.businessProfile;

  // Left: logo image or fallback text
  let logoEmbedded = false;
  if (data.logoUrl) {
    try {
      const resp = await fetch(data.logoUrl);
      const buf  = await resp.arrayBuffer();
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

  // Right: business info block
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
  if (contactLine) {
    tr(contactLine, RX, bry, reg, 9, GRAY);
  }

  y = LOGO_TOP - LOGO_MAX_H - 18;   // y ≈ 677

  hLine(y);
  y -= 1;

  // ── Document title block ──────────────────────────────────────────────────
  y -= 20;
  page.drawText("QUOTE", { x: M, y, font: bold, size: 28, color: ORANGE });

  const qNum = data.quoteNumber ?? `QUO-${data.jobName.replace(/[^A-Z0-9]/gi, "").slice(0, 6).toUpperCase()}`;
  tr(qNum, RX, y + 12, bold, 10, BLACK);
  tr(`Date: ${data.date}`, RX, y - 2, reg, 9, GRAY);
  tr("Valid for 30 days", RX, y - 15, reg, 9, GRAY);

  y -= 18;
  y -= 18;
  hLine(y);
  y -= 1;

  // ── Client + Job info (two columns) ──────────────────────────────────────
  const COL2 = M + Math.round(CW * 0.48);  // ≈ 296
  const BLOCK_TOP = y - 14;

  // Left: TO
  page.drawText("TO", { x: M, y: BLOCK_TOP, font: bold, size: 8, color: GRAY });
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
  // Job type badges
  if (data.jobTypes && data.jobTypes.length > 0) {
    ry2 -= 4;
    let bx = COL2;
    for (const jt of data.jobTypes.slice(0, 5)) {
      const tw = bold.widthOfTextAtSize(jt, 7.5);
      const bw = tw + 10;
      if (bx + bw > RX) break;
      page.drawRectangle({ x: bx, y: ry2 - 3, width: bw, height: 14, color: ORANGE_BG });
      page.drawText(jt, { x: bx + 5, y: ry2, font: bold, size: 7.5, color: ORANGE });
      bx += bw + 5;
    }
    ry2 -= 18;
  }

  y = Math.min(ly, ry2) - 14;
  hLine(y);
  y -= 1;

  // ── Line items table ──────────────────────────────────────────────────────
  y -= 16;

  // Table header row
  page.drawRectangle({ x: M, y: y - 5, width: CW, height: 20, color: ALT_ROW });
  page.drawText("DESCRIPTION", { x: TC_D + 2, y, font: bold, size: 7.5, color: GRAY });
  tr("QTY",       TC_Q_R - 2, y, bold, 7.5, GRAY);
  page.drawText("UNIT",       { x: TC_U,     y, font: bold, size: 7.5, color: GRAY });
  tr("UNIT COST", TC_C_R - 2, y, bold, 7.5, GRAY);
  tr("TOTAL",     TC_T_R - 2, y, bold, 7.5, GRAY);
  y -= 6;
  hLine(y, 0.75, BLACK);
  y -= 3;

  let rowIdx = 0;

  function drawItemRow(desc: string, qty: string, unit: string, cost: string, total: string) {
    if (rowIdx % 2 === 1) {
      page.drawRectangle({ x: M, y: y - 5, width: CW, height: ROW_H, color: ALT_ROW });
    }
    const maxDescW = TC_Q_R - TC_D - 10;
    page.drawText(clip(desc, reg, 9.5, maxDescW), { x: TC_D + 2, y, font: reg, size: 9.5, color: BLACK });
    if (qty)  tr(qty,  TC_Q_R - 2, y, reg, 9.5, BLACK);
    if (unit) page.drawText(unit, { x: TC_U, y, font: reg, size: 9.5, color: BLACK });
    if (cost) tr(cost, TC_C_R - 2, y, reg, 9.5, BLACK);
    tr(total, TC_T_R - 2, y, bold, 9.5, BLACK);
    y -= ROW_H;
    rowIdx++;
  }

  const hasLineItems  = (data.lineItems  ?? []).length > 0;
  const hasLaborItems = (data.laborItems ?? []).length > 0;

  if (hasLineItems) {
    for (const item of data.lineItems!) {
      drawItemRow(item.description, item.qty.toString(), item.unit || "ea", fmtMoney(item.unitCost), fmtTotal(item.total));
    }
  } else if (data.materialsTotal > 0) {
    drawItemRow("Materials", "", "", "", fmtTotal(data.materialsTotal));
  }

  if (hasLaborItems) {
    for (const item of data.laborItems!) {
      drawItemRow(item.description || "Labor", item.hours.toString(), "hr", `$${item.rate}/hr`, fmtTotal(item.total));
    }
  } else if (data.laborTotal > 0) {
    drawItemRow("Labor", "", "", "", fmtTotal(data.laborTotal));
  }

  y -= 4;
  hLine(y);
  y -= 4;

  // ── Subtotals (right-aligned block) ──────────────────────────────────────
  const SUB_L = RX - 220;

  function subRow(label: string, value: string, lColor = GRAY, vColor = BLACK as typeof BLACK, vBold = true) {
    page.drawText(label, { x: SUB_L, y, font: reg, size: 9.5, color: lColor });
    tr(value, RX - 2, y, vBold ? bold : reg, 9.5, vColor);
    y -= 16;
  }

  if (data.materialsTotal > 0) subRow("Materials subtotal", fmtTotal(data.materialsTotal));
  if (data.laborTotal > 0)     subRow("Labor subtotal",     fmtTotal(data.laborTotal));

  const validAddons = data.addons.filter((a) => a.name && a.amount !== 0);
  if (validAddons.length > 0) {
    y -= 4;
    hLine(y, 0.4);
    y -= 14;
    page.drawText("ADD-ONS", { x: SUB_L, y, font: bold, size: 7.5, color: GRAY });
    y -= 14;
    for (const addon of validAddons) {
      const sign = addon.amount < 0 ? "−$" : "$";
      const val  = sign + Math.abs(Math.round(addon.amount)).toLocaleString("en-US");
      subRow(addon.name, val);
    }
  }

  y -= 4;
  hLine(y, 0.4);
  y -= 14;
  // Profit line in orange
  page.drawText(`Profit (${data.profitMarginPct}% on work)`, { x: SUB_L, y, font: reg, size: 9.5, color: GRAY });
  tr(`+${fmtTotal(data.profitAmount)}`, RX - 2, y, bold, 9.5, ORANGE);
  y -= 16;

  // Thick separator above total
  y -= 4;
  hLine(y, 1.5, BLACK);
  y -= 30;

  // Grand total
  page.drawText("TOTAL", { x: M, y: y + 6, font: bold, size: 16, color: BLACK });
  tr(fmtTotal(data.grandTotal), RX - 2, y, bold, 30, ORANGE);
  y -= 38;

  // ── Signature block ───────────────────────────────────────────────────────
  y -= 18;
  hLine(y);
  y -= 18;

  if (data.signatureData && data.signedByName) {
    // Embed the actual signature image
    try {
      const b64 = data.signatureData.replace(/^data:image\/png;base64,/, "");
      const sigBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const sigImg = await pdfDoc.embedPng(sigBytes);
      const sigDims = sigImg.scaleToFit(220, 70);
      page.drawImage(sigImg, { x: M, y: y - sigDims.height, width: sigDims.width, height: sigDims.height });
      y -= sigDims.height + 6;
    } catch { /* fall through */ }

    page.drawText(`Signed by: ${data.signedByName}`, { x: M, y, font: bold, size: 9, color: BLACK });
    if (data.signedAt) {
      tr(`Date: ${data.signedAt}`, RX - 2, y, reg, 9, GRAY);
    }
    y -= 14;
    // Green "ACCEPTED" stamp
    const GREEN = rgb(0.086, 0.643, 0.318);
    const stampText = "ACCEPTED";
    const stampW = bold.widthOfTextAtSize(stampText, 11) + 16;
    page.drawRectangle({ x: M, y: y - 4, width: stampW, height: 18, color: rgb(0.9, 0.98, 0.93) });
    page.drawText(stampText, { x: M + 8, y, font: bold, size: 11, color: GREEN });
  } else {
    // Blank signature lines
    page.drawText("Accepted by:", { x: M, y, font: reg, size: 9, color: GRAY });
    page.drawLine({ start: { x: M + 72, y: y - 2 }, end: { x: M + 280, y: y - 2 }, thickness: 0.5, color: LGRAY });
    page.drawText("Date:", { x: M + 300, y, font: reg, size: 9, color: GRAY });
    page.drawLine({ start: { x: M + 328, y: y - 2 }, end: { x: RX, y: y - 2 }, thickness: 0.5, color: LGRAY });
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const FY = 30;
  hLine(FY + 16, 0.4);
  const footParts: string[] = [];
  if (bp?.business_name)   footParts.push(`Quote prepared by ${bp.business_name}`);
  if (bp?.license_number)  footParts.push(`License # ${bp.license_number}`);
  if (bp?.phone)           footParts.push(bp.phone);
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
  a.download = `quote-${data.jobName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
