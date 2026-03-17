import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

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
  materialsTotal: number;
  laborTotal: number;
  addons: { name: string; amount: number }[];
  grandTotal: number;
  businessProfile?: BusinessProfileData | null;
  logoUrl?: string | null;
  client?: ClientData | null;
  paymentTermsLabel?: string; // "Due on Receipt", "Net 15", etc.
  dueDate?: string | null;    // "April 15, 2026"
  notes?: string | null;
}

function fmt(n: number) {
  return "$" + Math.round(n).toLocaleString("en-US");
}

const ORANGE = rgb(0.976, 0.451, 0.086);
const BLACK  = rgb(0.08, 0.08, 0.08);
const GRAY   = rgb(0.55, 0.55, 0.55);
const LGRAY  = rgb(0.82, 0.82, 0.82);
const WHITE  = rgb(1, 1, 1);
const DARK   = rgb(0.08, 0.08, 0.08);
const RED    = rgb(0.85, 0.15, 0.15);
const BGDARK = rgb(0.13, 0.13, 0.13);

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 48;
const COL_R  = PAGE_W - MARGIN;
const CONTENT_W = PAGE_W - MARGIN * 2;

export async function generateAndDownloadInvoicePDF(data: InvoicePDFData) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let y = PAGE_H;

  // ── HEADER BAR ──────────────────────────────────────────────────────────
  const headerH = 72;
  page.drawRectangle({ x: 0, y: PAGE_H - headerH, width: PAGE_W, height: headerH, color: DARK });

  const bp = data.businessProfile;
  let logoEmbedded = false;
  const logoX = MARGIN;
  const logoAreaW = 160;

  // Try to embed logo
  if (data.logoUrl) {
    try {
      const resp = await fetch(data.logoUrl);
      const buf = await resp.arrayBuffer();
      const bytes = new Uint8Array(buf);
      // Detect PNG by magic bytes
      const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
      const img = isPng
        ? await pdfDoc.embedPng(buf)
        : await pdfDoc.embedJpg(buf);
      const logoH = 44;
      const ratio = img.width / img.height;
      const logoW = Math.min(ratio * logoH, logoAreaW);
      page.drawImage(img, {
        x: logoX,
        y: PAGE_H - headerH / 2 - logoH / 2,
        width: logoW,
        height: logoH,
      });
      logoEmbedded = true;
    } catch {
      // fall through to text fallback
    }
  }

  if (!logoEmbedded) {
    // Dot + business name
    page.drawCircle({ x: MARGIN + 5, y: PAGE_H - headerH / 2, size: 5, color: ORANGE });
    const headerName = bp?.business_name ?? "SIGHTLINE";
    page.drawText(headerName.toUpperCase(), {
      x: MARGIN + 16, y: PAGE_H - headerH / 2 - 7,
      font: bold, size: bp?.business_name ? 15 : 17, color: WHITE,
    });
  }

  // Right side: business contact block
  const bpRightLines: string[] = [];
  if (bp?.business_name && logoEmbedded) bpRightLines.push(bp.business_name);
  if (bp?.owner_name) bpRightLines.push(bp.owner_name);
  if (bp?.license_number) bpRightLines.push(`Lic# ${bp.license_number}`);
  if (!bpRightLines.length) bpRightLines.push("Every job. One view.");

  const lineH = 13;
  const blockH = bpRightLines.length * lineH;
  let ry = PAGE_H - headerH / 2 + blockH / 2 - 4;
  for (const line of bpRightLines) {
    const w = reg.widthOfTextAtSize(line, 9);
    page.drawText(line, { x: COL_R - w, y: ry, font: reg, size: 9, color: GRAY });
    ry -= lineH;
  }

  y = PAGE_H - headerH - 28;

  // ── CONTRACTOR CONTACT LINE ───────────────────────────────────────────────
  const contactParts: string[] = [];
  if (bp?.phone) contactParts.push(bp.phone);
  if (bp?.email) contactParts.push(bp.email);
  else if (data.contractorEmail) contactParts.push(data.contractorEmail);
  if (bp?.address) contactParts.push(bp.address);
  const contactLine = contactParts.join("   ") || data.contractorEmail;
  page.drawText(contactLine, { x: MARGIN, y, font: reg, size: 8.5, color: GRAY });
  y -= 28;

  // ── INVOICE HEADER ROW ───────────────────────────────────────────────────
  page.drawText("INVOICE", { x: MARGIN, y, font: bold, size: 22, color: BLACK });
  // Invoice number + date stacked right
  const invNumW = bold.widthOfTextAtSize(data.invoiceNumber, 10);
  page.drawText(data.invoiceNumber, { x: COL_R - invNumW, y: y + 2, font: bold, size: 10, color: BLACK });
  const dateW = reg.widthOfTextAtSize(data.date, 9);
  page.drawText(data.date, { x: COL_R - dateW, y: y - 13, font: reg, size: 9, color: GRAY });
  y -= 32;

  // ── DIVIDER ───────────────────────────────────────────────────────────────
  page.drawLine({ start: { x: MARGIN, y }, end: { x: COL_R, y }, thickness: 1, color: LGRAY });
  y -= 20;

  // ── TWO COLUMNS: Bill To (left) | Job Info (right) ────────────────────────
  const colMid = MARGIN + CONTENT_W * 0.5;
  const blockStartY = y;

  // Left: Bill To
  page.drawText("BILL TO", { x: MARGIN, y, font: bold, size: 8, color: GRAY });
  y -= 16;

  if (data.client) {
    page.drawText(data.client.name, { x: MARGIN, y, font: bold, size: 11, color: BLACK });
    y -= 15;
    if (data.client.company) {
      page.drawText(data.client.company, { x: MARGIN, y, font: reg, size: 9.5, color: GRAY });
      y -= 13;
    }
    if (data.client.address) {
      page.drawText(data.client.address, { x: MARGIN, y, font: reg, size: 9, color: GRAY });
      y -= 13;
    }
    if (data.client.phone) {
      page.drawText(data.client.phone, { x: MARGIN, y, font: reg, size: 9, color: GRAY });
      y -= 13;
    }
    if (data.client.email) {
      page.drawText(data.client.email, { x: MARGIN, y, font: reg, size: 9, color: GRAY });
      y -= 13;
    }
  } else {
    page.drawText(data.jobName, { x: MARGIN, y, font: bold, size: 11, color: BLACK });
    y -= 15;
    if (data.jobAddress) {
      page.drawText(data.jobAddress, { x: MARGIN, y, font: reg, size: 9, color: GRAY });
      y -= 13;
    }
  }

  // Right: Job / Payment info
  let ry2 = blockStartY;
  page.drawText("JOB", { x: colMid, y: ry2, font: bold, size: 8, color: GRAY });
  ry2 -= 16;
  // Truncate job name
  let jName = data.jobName;
  const maxJW = COL_R - colMid;
  while (bold.widthOfTextAtSize(jName, 11) > maxJW && jName.length > 4) {
    jName = jName.slice(0, -4) + "...";
  }
  page.drawText(jName, { x: colMid, y: ry2, font: bold, size: 11, color: BLACK });
  ry2 -= 15;
  if (data.jobAddress) {
    let addr = data.jobAddress;
    while (reg.widthOfTextAtSize(addr, 9) > maxJW && addr.length > 4) {
      addr = addr.slice(0, -4) + "...";
    }
    page.drawText(addr, { x: colMid, y: ry2, font: reg, size: 9, color: GRAY });
    ry2 -= 20;
  }

  // Payment terms block
  if (data.paymentTermsLabel) {
    page.drawText("TERMS", { x: colMid, y: ry2, font: bold, size: 8, color: GRAY });
    ry2 -= 14;
    page.drawText(data.paymentTermsLabel, { x: colMid, y: ry2, font: bold, size: 10, color: BLACK });
    ry2 -= 14;
    if (data.dueDate) {
      page.drawText(`Due ${data.dueDate}`, { x: colMid, y: ry2, font: reg, size: 9, color: RED });
    }
  }

  // Advance y past whichever column is taller
  y = Math.min(y, ry2) - 20;

  // ── DIVIDER ───────────────────────────────────────────────────────────────
  page.drawLine({ start: { x: MARGIN, y }, end: { x: COL_R, y }, thickness: 0.75, color: LGRAY });
  y -= 22;

  // ── LINE ITEMS ────────────────────────────────────────────────────────────
  // Table header
  page.drawText("DESCRIPTION", { x: MARGIN, y, font: bold, size: 8, color: GRAY });
  const amtHdr = "AMOUNT";
  const amtHdrW = bold.widthOfTextAtSize(amtHdr, 8);
  page.drawText(amtHdr, { x: COL_R - amtHdrW, y, font: bold, size: 8, color: GRAY });
  y -= 14;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: COL_R, y }, thickness: 0.5, color: LGRAY });
  y -= 18;

  function drawRow(
    label: string, value: string,
    lSize = 11, vSize = 11,
    lFont = reg, vFont = bold,
    lColor = BLACK, vColor = BLACK
  ) {
    page.drawText(label, { x: MARGIN, y, font: lFont, size: lSize, color: lColor });
    const vw = vFont.widthOfTextAtSize(value, vSize);
    page.drawText(value, { x: COL_R - vw, y, font: vFont, size: vSize, color: vColor });
    y -= 22;
  }

  drawRow("Materials", fmt(data.materialsTotal));
  drawRow("Labor", fmt(data.laborTotal));

  const validAddons = data.addons.filter((a) => a.name && a.amount !== 0);
  if (validAddons.length > 0) {
    y -= 4;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: COL_R, y }, thickness: 0.4, color: LGRAY });
    y -= 14;
    page.drawText("ADD-ONS / CHANGE ORDERS", { x: MARGIN, y, font: bold, size: 8, color: GRAY });
    y -= 16;
    for (const addon of validAddons) {
      const sign = addon.amount < 0 ? "−$" : "$";
      const val = sign + Math.abs(Math.round(addon.amount)).toLocaleString("en-US");
      drawRow(addon.name, val, 10, 10, reg, bold, BLACK, addon.amount < 0 ? GRAY : BLACK);
    }
  }

  // ── TOTAL BAR ─────────────────────────────────────────────────────────────
  y -= 4;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: COL_R, y }, thickness: 1.5, color: BLACK });
  y -= 30;

  // Total Due label + amount
  page.drawText("TOTAL DUE", { x: MARGIN, y, font: bold, size: 16, color: BLACK });
  const totalStr = fmt(data.grandTotal);
  const totalW = bold.widthOfTextAtSize(totalStr, 26);
  page.drawText(totalStr, { x: COL_R - totalW, y: y - 4, font: bold, size: 26, color: ORANGE });
  y -= 44;

  // ── PAYMENT TERMS REMINDER ────────────────────────────────────────────────
  if (data.paymentTermsLabel) {
    const termsLine = data.dueDate
      ? `Payment terms: ${data.paymentTermsLabel} · Due ${data.dueDate}`
      : `Payment terms: ${data.paymentTermsLabel}`;
    page.drawText(termsLine, { x: MARGIN, y, font: reg, size: 9, color: GRAY });
    y -= 18;
  } else {
    page.drawText("Please remit payment upon receipt. Thank you for your business.", {
      x: MARGIN, y, font: reg, size: 9, color: GRAY,
    });
    y -= 18;
  }

  // ── NOTES ─────────────────────────────────────────────────────────────────
  if (data.notes && data.notes.trim()) {
    y -= 6;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: COL_R, y }, thickness: 0.4, color: LGRAY });
    y -= 16;
    page.drawText("NOTES", { x: MARGIN, y, font: bold, size: 8, color: GRAY });
    y -= 14;
    // Word-wrap notes
    const words = data.notes.trim().split(/\s+/);
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (reg.widthOfTextAtSize(test, 9.5) > CONTENT_W) {
        page.drawText(line, { x: MARGIN, y, font: reg, size: 9.5, color: BLACK });
        y -= 14;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) {
      page.drawText(line, { x: MARGIN, y, font: reg, size: 9.5, color: BLACK });
      y -= 14;
    }
  }

  // ── FOOTER ────────────────────────────────────────────────────────────────
  const footerY = 32;
  page.drawLine({ start: { x: MARGIN, y: footerY + 14 }, end: { x: COL_R, y: footerY + 14 }, thickness: 0.5, color: LGRAY });
  const footer = "Generated by Sightline · sightline.one";
  const footerW = reg.widthOfTextAtSize(footer, 8);
  page.drawText(footer, { x: PAGE_W / 2 - footerW / 2, y: footerY, font: reg, size: 8, color: GRAY });

  // ── DOWNLOAD ──────────────────────────────────────────────────────────────
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = data.jobName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  a.href = url;
  a.download = `invoice-${safeName}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
