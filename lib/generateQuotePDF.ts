import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export interface BusinessProfileData {
  business_name?: string | null;
  owner_name?: string | null;
  license_number?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface QuotePDFData {
  contractorEmail: string;
  jobName: string;
  jobAddress: string;
  date: string;
  materialsTotal: number;
  laborTotal: number;
  addons: { name: string; amount: number }[];
  profitMarginPct: number;
  profitAmount: number;
  grandTotal: number;
  businessProfile?: BusinessProfileData | null;
}

function fmt(n: number) {
  return "$" + Math.round(n).toLocaleString("en-US");
}

const ORANGE = rgb(0.976, 0.451, 0.086); // #F97316
const BLACK  = rgb(0.08, 0.08, 0.08);
const GRAY   = rgb(0.55, 0.55, 0.55);
const LGRAY  = rgb(0.82, 0.82, 0.82);
const WHITE  = rgb(1, 1, 1);
const DARK   = rgb(0.08, 0.08, 0.08);

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 44;
const CONTENT_W = PAGE_W - MARGIN * 2;

export async function generateAndDownloadQuotePDF(data: QuotePDFData) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);

  const bold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const reg    = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let y = PAGE_H;

  // ── HEADER BAR ───────────────────────────────────────────────────────────
  const headerH = 56;
  page.drawRectangle({ x: 0, y: PAGE_H - headerH, width: PAGE_W, height: headerH, color: DARK });
  page.drawCircle({ x: MARGIN, y: PAGE_H - headerH / 2, size: 5, color: ORANGE });
  const bp = data.businessProfile;
  const headerName = bp?.business_name || "SIGHTLINE";
  page.drawText(headerName.toUpperCase(), {
    x: MARGIN + 14, y: PAGE_H - headerH / 2 - 6,
    font: bold, size: bp?.business_name ? 14 : 16, color: WHITE,
  });
  const headerRight = bp?.business_name
    ? [bp.owner_name, bp.license_number ? `Lic# ${bp.license_number}` : null].filter(Boolean).join("  ·  ") || "Every job. One view."
    : "Every job. One view.";
  const tagW = reg.widthOfTextAtSize(headerRight, 9);
  page.drawText(headerRight, {
    x: PAGE_W - MARGIN - tagW, y: PAGE_H - headerH / 2 - 4,
    font: reg, size: 9, color: GRAY,
  });

  y = PAGE_H - headerH - 28;

  // ── CONTRACTOR INFO ──────────────────────────────────────────────────────
  const bp2 = data.businessProfile;
  const contactLine = bp2?.business_name
    ? [bp2.phone, bp2.email || data.contractorEmail].filter(Boolean).join("   ")
    : data.contractorEmail;
  page.drawText(contactLine, { x: MARGIN, y, font: reg, size: 9, color: GRAY });
  y -= 24;

  // ── QUOTE LABEL + DATE ───────────────────────────────────────────────────
  page.drawText("QUOTE", { x: MARGIN, y, font: bold, size: 10, color: ORANGE });
  const dateW = reg.widthOfTextAtSize(data.date, 9);
  page.drawText(data.date, {
    x: PAGE_W - MARGIN - dateW, y: y + 1,
    font: reg, size: 9, color: GRAY,
  });
  y -= 20;

  // ── JOB NAME ─────────────────────────────────────────────────────────────
  // Truncate if too long
  let jobNameDisplay = data.jobName;
  while (bold.widthOfTextAtSize(jobNameDisplay, 22) > CONTENT_W && jobNameDisplay.length > 4) {
    jobNameDisplay = jobNameDisplay.slice(0, -4) + "...";
  }
  page.drawText(jobNameDisplay, { x: MARGIN, y, font: bold, size: 22, color: BLACK });
  y -= 22;

  // ── JOB ADDRESS ──────────────────────────────────────────────────────────
  if (data.jobAddress) {
    page.drawText(data.jobAddress, { x: MARGIN, y, font: reg, size: 10, color: GRAY });
    y -= 14;
  }

  y -= 16;
  // ── DIVIDER ──────────────────────────────────────────────────────────────
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.75, color: LGRAY });
  y -= 22;

  // ── ROW HELPER ───────────────────────────────────────────────────────────
  function drawRow(label: string, value: string, labelSize = 11, valueSize = 11,
    labelFont = reg, valueFont = bold, labelColor = BLACK, valueColor = BLACK) {
    page.drawText(label, { x: MARGIN, y, font: labelFont, size: labelSize, color: labelColor });
    const vw = valueFont.widthOfTextAtSize(value, valueSize);
    page.drawText(value, { x: PAGE_W - MARGIN - vw, y, font: valueFont, size: valueSize, color: valueColor });
    y -= 22;
  }

  // ── MATERIALS ────────────────────────────────────────────────────────────
  drawRow("Materials", fmt(data.materialsTotal));
  // ── LABOR ────────────────────────────────────────────────────────────────
  drawRow("Labor", fmt(data.laborTotal));

  // ── ADD-ONS ──────────────────────────────────────────────────────────────
  const validAddons = data.addons.filter((a) => a.name && a.amount > 0);
  if (validAddons.length > 0) {
    y -= 6;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: LGRAY });
    y -= 16;
    page.drawText("ADD-ONS", { x: MARGIN, y, font: bold, size: 8, color: GRAY });
    y -= 16;
    for (const addon of validAddons) {
      drawRow(addon.name, fmt(addon.amount), 10, 10);
    }
  }

  // ── PROFIT ───────────────────────────────────────────────────────────────
  y -= 4;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: LGRAY });
  y -= 18;
  drawRow(`Profit (${data.profitMarginPct}% on work)`, `+${fmt(data.profitAmount)}`,
    10, 10, reg, bold, GRAY, ORANGE);

  // ── TOTAL BAR ────────────────────────────────────────────────────────────
  y -= 4;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1.5, color: BLACK });
  y -= 26;
  page.drawText("TOTAL", { x: MARGIN, y, font: bold, size: 16, color: BLACK });
  const totalStr = fmt(data.grandTotal);
  const totalW = bold.widthOfTextAtSize(totalStr, 24);
  page.drawText(totalStr, { x: PAGE_W - MARGIN - totalW, y: y - 4, font: bold, size: 24, color: ORANGE });
  y -= 36;

  // ── FOOTER ───────────────────────────────────────────────────────────────
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: LGRAY });
  y -= 16;
  const footer = "Generated by Sightline · sightline.one";
  const footerW = reg.widthOfTextAtSize(footer, 8);
  page.drawText(footer, {
    x: PAGE_W / 2 - footerW / 2, y,
    font: reg, size: 8, color: GRAY,
  });

  // ── DOWNLOAD ─────────────────────────────────────────────────────────────
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = data.jobName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  a.href = url;
  a.download = `quote-${safeName}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
