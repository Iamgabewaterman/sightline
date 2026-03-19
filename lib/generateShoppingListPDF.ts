import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

const ORANGE = rgb(0.976, 0.451, 0.086);
const DARK   = rgb(0.08, 0.08, 0.08);
const GRAY   = rgb(0.55, 0.55, 0.55);
const LGRAY  = rgb(0.82, 0.82, 0.82);
const WHITE  = rgb(1, 1, 1);
const GREEN  = rgb(0.24, 0.71, 0.44);

const PAGE_W  = 612;
const PAGE_H  = 792;
const MARGIN  = 48;
const COL_R   = PAGE_W - MARGIN;
const HEADER_H = 64;

export interface ShoppingListPDFItem {
  name: string;
  qtyNeeded: number;
  unit: string;
  unitCost: number | null;
  category: string;
}

export interface ShoppingListBusinessProfile {
  business_name?: string | null;
  owner_name?: string | null;
}

export interface ShoppingListPDFData {
  jobName: string;
  items: ShoppingListPDFItem[];
  businessProfile?: ShoppingListBusinessProfile | null;
}

const CAT_LABELS: Record<string, string> = {
  materials: "Materials", equipment: "Equipment", labor: "Labor",
  vehicle: "Vehicle", subcontractor: "Subcontractors", permits: "Permits",
  insurance: "Insurance", other: "Other",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export async function generateShoppingListPDF(data: ShoppingListPDFData): Promise<void> {
  const { jobName, items, businessProfile: bp } = data;
  const businessName = bp?.business_name ?? "Sightline";

  const pdfDoc = await PDFDocument.create();
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const pages: ReturnType<typeof pdfDoc.addPage>[] = [];
  function addPage() {
    const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    pages.push(page);
    // Header
    page.drawRectangle({ x: 0, y: PAGE_H - HEADER_H, width: PAGE_W, height: HEADER_H, color: DARK });
    page.drawCircle({ x: MARGIN + 5, y: PAGE_H - HEADER_H / 2, size: 5, color: ORANGE });
    page.drawText(businessName.toUpperCase(), {
      x: MARGIN + 16, y: PAGE_H - HEADER_H / 2 - 7,
      font: bold, size: 15, color: WHITE,
    });
    const sub = bp?.owner_name ?? "Shopping List";
    const subW = reg.widthOfTextAtSize(sub, 9);
    page.drawText(sub, { x: COL_R - subW, y: PAGE_H - HEADER_H / 2 - 4, font: reg, size: 9, color: GRAY });
    return page;
  }

  const page = addPage();
  let y = PAGE_H - HEADER_H - 44;

  // Title
  page.drawText("MATERIAL SHOPPING LIST", { x: MARGIN, y, font: bold, size: 20, color: DARK });
  y -= 8;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: COL_R, y }, thickness: 3, color: ORANGE });
  y -= 28;

  // Job + date
  page.drawText("JOB", { x: MARGIN, y, font: bold, size: 8, color: GRAY });
  y -= 16;
  page.drawText(jobName, { x: MARGIN, y, font: bold, size: 16, color: DARK });
  y -= 20;
  page.drawText(fmtDate(new Date().toISOString()), { x: MARGIN, y, font: reg, size: 11, color: GRAY });
  y -= 32;

  page.drawLine({ start: { x: MARGIN, y }, end: { x: COL_R, y }, thickness: 0.75, color: LGRAY });
  y -= 20;

  // Group by category
  const grouped = new Map<string, ShoppingListPDFItem[]>();
  for (const item of items) {
    const cat = item.category ?? "other";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(item);
  }

  const ITEM_H = 28;
  const CAT_H  = 32;
  const CHECKBOX_SIZE = 10;

  let totalCost = 0;

  Array.from(grouped.entries()).forEach(([cat, catItems]) => {
    if (y < 120) return; // skip if no room (would need pagination, rare for a shopping list)

    // Category header
    page.drawText(CAT_LABELS[cat] ?? cat, { x: MARGIN, y, font: bold, size: 11, color: DARK });
    y -= CAT_H - 10;

    for (const item of catItems) {
      if (y < 80) return;

      // Checkbox
      page.drawRectangle({
        x: MARGIN, y: y - 10, width: CHECKBOX_SIZE, height: CHECKBOX_SIZE,
        borderColor: GRAY, borderWidth: 1.5,
      });

      // Name
      const nameX = MARGIN + CHECKBOX_SIZE + 10;
      page.drawText(item.name, { x: nameX, y, font: bold, size: 10, color: DARK });

      // Qty + unit
      const qtyStr = item.qtyNeeded > 0
        ? `${item.qtyNeeded % 1 === 0 ? item.qtyNeeded : item.qtyNeeded.toFixed(2)} ${item.unit}`
        : item.unit;
      page.drawText(qtyStr, { x: nameX, y: y - 13, font: reg, size: 8.5, color: GRAY });

      // Cost (right aligned)
      if (item.unitCost !== null && item.qtyNeeded > 0) {
        const cost = item.qtyNeeded * item.unitCost;
        totalCost += cost;
        const costStr = "$" + Math.round(cost).toLocaleString();
        const costW = bold.widthOfTextAtSize(costStr, 10);
        page.drawText(costStr, { x: COL_R - costW, y, font: bold, size: 10, color: DARK });
      }

      y -= ITEM_H;
    }

    y -= 8;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: COL_R, y }, thickness: 0.5, color: LGRAY });
    y -= 16;
  });

  // Total
  if (totalCost > 0) {
    page.drawRectangle({ x: MARGIN, y: y - 20, width: COL_R - MARGIN, height: 40, color: rgb(0.05, 0.05, 0.05) });
    page.drawText("ESTIMATED TOTAL", { x: MARGIN + 12, y: y - 4, font: bold, size: 9, color: GRAY });
    const totalStr = "$" + Math.round(totalCost).toLocaleString();
    const totalW = bold.widthOfTextAtSize(totalStr, 22);
    page.drawText(totalStr, { x: COL_R - totalW - 12, y: y - 4, font: bold, size: 22, color: ORANGE });
    page.drawText("Oregon regional pricing", { x: MARGIN + 12, y: y - 18, font: reg, size: 7, color: GRAY });
  }

  // Footer on each page
  const totalPages = pages.length;
  for (let i = 0; i < pages.length; i++) {
    const fp = pages[i];
    const footerY = 20;
    fp.drawLine({ start: { x: MARGIN, y: footerY + 14 }, end: { x: COL_R, y: footerY + 14 }, thickness: 0.5, color: LGRAY });
    fp.drawText(businessName, { x: MARGIN, y: footerY, font: reg, size: 7.5, color: GRAY });
    const center = "Material Shopping List";
    const cw = reg.widthOfTextAtSize(center, 7.5);
    fp.drawText(center, { x: PAGE_W / 2 - cw / 2, y: footerY, font: reg, size: 7.5, color: GRAY });
    const pgStr = `${i + 1} / ${totalPages}`;
    const pgW = reg.widthOfTextAtSize(pgStr, 7.5);
    fp.drawText(pgStr, { x: COL_R - pgW, y: footerY, font: reg, size: 7.5, color: GRAY });
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = jobName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  a.href = url;
  a.download = `shopping-list-${safeName}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
