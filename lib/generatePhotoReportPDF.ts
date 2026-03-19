import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "pdf-lib";
import { Photo, PhotoCategory } from "@/types";

export interface PhotoReportBusinessProfile {
  business_name?: string | null;
  owner_name?: string | null;
  license_number?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface PhotoReportDocument {
  name: string;
  category: string;
  created_at: string;
}

export interface PhotoReportData {
  jobName: string;
  jobAddress: string;
  clientName?: string | null;
  selectedCategories: PhotoCategory[];
  photos: Photo[];
  businessProfile?: PhotoReportBusinessProfile | null;
  logoUrl?: string | null;
  getPublicUrl: (path: string) => string;
  documents?: PhotoReportDocument[] | null;
}

const ORANGE = rgb(0.976, 0.451, 0.086);
const DARK   = rgb(0.08, 0.08, 0.08);
const GRAY   = rgb(0.55, 0.55, 0.55);
const LGRAY  = rgb(0.82, 0.82, 0.82);
const WHITE  = rgb(1, 1, 1);

const PAGE_W    = 612;
const PAGE_H    = 792;
const MARGIN    = 48;
const COL_R     = PAGE_W - MARGIN;
const CONTENT_W = PAGE_W - MARGIN * 2;
const HEADER_H  = 72;
const FOOTER_H  = 36;

function fmtFull(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    + " · " + new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function categoryLabel(cat: PhotoCategory) {
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

async function drawHeader(
  page: PDFPage,
  pdfDoc: PDFDocument,
  bold: PDFFont,
  reg: PDFFont,
  bp: PhotoReportBusinessProfile | null | undefined,
  logoImg: { img: Awaited<ReturnType<PDFDocument["embedJpg"]>>; isPng: boolean } | null,
) {
  page.drawRectangle({ x: 0, y: PAGE_H - HEADER_H, width: PAGE_W, height: HEADER_H, color: DARK });

  if (logoImg) {
    const logoH = 44;
    const ratio = logoImg.img.width / logoImg.img.height;
    const logoW = Math.min(ratio * logoH, 160);
    page.drawImage(logoImg.img, {
      x: MARGIN,
      y: PAGE_H - HEADER_H / 2 - logoH / 2,
      width: logoW,
      height: logoH,
    });
  } else {
    page.drawCircle({ x: MARGIN + 5, y: PAGE_H - HEADER_H / 2, size: 5, color: ORANGE });
    const headerName = bp?.business_name ?? "SIGHTLINE";
    page.drawText(headerName.toUpperCase(), {
      x: MARGIN + 16, y: PAGE_H - HEADER_H / 2 - 7,
      font: bold, size: bp?.business_name ? 15 : 17, color: WHITE,
    });
  }

  const lines: string[] = [];
  if (bp?.business_name && logoImg) lines.push(bp.business_name);
  if (bp?.owner_name) lines.push(bp.owner_name);
  if (bp?.license_number) lines.push(`Lic# ${bp.license_number}`);
  if (!lines.length) lines.push("Every job. One view.");

  const lineH = 13;
  const blockH = lines.length * lineH;
  let ry = PAGE_H - HEADER_H / 2 + blockH / 2 - 4;
  for (const line of lines) {
    const w = reg.widthOfTextAtSize(line, 9);
    page.drawText(line, { x: COL_R - w, y: ry, font: reg, size: 9, color: GRAY });
    ry -= lineH;
  }
}

function drawFooter(
  page: PDFPage,
  bold: PDFFont,
  reg: PDFFont,
  businessName: string,
  jobName: string,
  pageNum: number,
  totalPages: number,
) {
  const footerY = 20;
  page.drawLine({
    start: { x: MARGIN, y: footerY + 14 },
    end: { x: COL_R, y: footerY + 14 },
    thickness: 0.5, color: LGRAY,
  });

  // Left: business name
  page.drawText(businessName, { x: MARGIN, y: footerY, font: reg, size: 7.5, color: GRAY });

  // Center: job name
  const centerText = jobName;
  const centerW = reg.widthOfTextAtSize(centerText, 7.5);
  page.drawText(centerText, { x: PAGE_W / 2 - centerW / 2, y: footerY, font: reg, size: 7.5, color: GRAY });

  // Right: page number
  const pageStr = `${pageNum} / ${totalPages}`;
  const pageW = reg.widthOfTextAtSize(pageStr, 7.5);
  page.drawText(pageStr, { x: COL_R - pageW, y: footerY, font: reg, size: 7.5, color: GRAY });
}

export async function generatePhotoReportPDF(data: PhotoReportData): Promise<void> {
  const { jobName, jobAddress, clientName, selectedCategories, photos, businessProfile: bp, getPublicUrl } = data;

  const pdfDoc = await PDFDocument.create();
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const businessName = bp?.business_name ?? "Sightline";

  // ── Pre-fetch logo ──────────────────────────────────────────────────────────
  let logoImg: { img: Awaited<ReturnType<PDFDocument["embedJpg"]>>; isPng: boolean } | null = null;
  if (data.logoUrl) {
    try {
      const resp = await fetch(data.logoUrl);
      const buf = await resp.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
      const img = isPng ? await pdfDoc.embedPng(buf) : await pdfDoc.embedJpg(buf);
      logoImg = { img, isPng };
    } catch { /* ignore */ }
  }

  // ── Pre-fetch all selected photos ──────────────────────────────────────────
  const orderedPhotos: Photo[] = [];
  for (const cat of selectedCategories) {
    const catPhotos = photos
      .filter((p) => p.category === cat)
      .sort((a, b) => {
        const da = a.taken_at ?? a.created_at;
        const db = b.taken_at ?? b.created_at;
        return da < db ? -1 : da > db ? 1 : 0;
      });
    orderedPhotos.push(...catPhotos);
  }

  type EmbeddedPhoto = { photo: Photo; img: Awaited<ReturnType<PDFDocument["embedJpg"]>> | null };
  const embeddedPhotos: EmbeddedPhoto[] = await Promise.all(
    orderedPhotos.map(async (photo) => {
      try {
        const url = getPublicUrl(photo.storage_path);
        const resp = await fetch(url);
        const buf = await resp.arrayBuffer();
        const bytes = new Uint8Array(buf);
        const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
        const img = isPng ? await pdfDoc.embedPng(buf) : await pdfDoc.embedJpg(buf);
        return { photo, img };
      } catch {
        return { photo, img: null };
      }
    })
  );

  // We'll build pages, then go back and fill footers with correct total page count
  // Since pdf-lib doesn't support forward references easily, we collect pages first

  const pages: PDFPage[] = [];

  function addPage() {
    const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    pages.push(page);
    return page;
  }

  // ── COVER PAGE ─────────────────────────────────────────────────────────────
  {
    const page = addPage();

    await drawHeader(page, pdfDoc, bold, reg, bp, logoImg);

    // Contact line below header
    const contactParts: string[] = [];
    if (bp?.phone)  contactParts.push(bp.phone);
    if (bp?.email)  contactParts.push(bp.email);
    if (bp?.address) contactParts.push(bp.address);
    const contactLine = contactParts.join("   ");
    if (contactLine) {
      page.drawText(contactLine, {
        x: MARGIN, y: PAGE_H - HEADER_H - 22,
        font: reg, size: 8.5, color: GRAY,
      });
    }

    // Report title
    let y = PAGE_H - HEADER_H - 68;
    page.drawText("INSURANCE DOCUMENTATION REPORT", {
      x: MARGIN, y, font: bold, size: 20, color: DARK,
    });
    y -= 8;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: COL_R, y }, thickness: 3, color: ORANGE });
    y -= 32;

    // Job info block
    page.drawText("JOB", { x: MARGIN, y, font: bold, size: 8, color: GRAY });
    y -= 16;
    page.drawText(jobName, { x: MARGIN, y, font: bold, size: 16, color: DARK });
    y -= 20;
    if (jobAddress) {
      page.drawText(jobAddress, { x: MARGIN, y, font: reg, size: 11, color: GRAY });
      y -= 16;
    }
    if (clientName) {
      page.drawText(clientName, { x: MARGIN, y, font: reg, size: 11, color: GRAY });
      y -= 16;
    }
    y -= 24;

    // Divider
    page.drawLine({ start: { x: MARGIN, y }, end: { x: COL_R, y }, thickness: 0.75, color: LGRAY });
    y -= 28;

    // Report details
    page.drawText("CATEGORIES INCLUDED", { x: MARGIN, y, font: bold, size: 8, color: GRAY });
    y -= 16;
    const catLabels = selectedCategories.map(categoryLabel).join("   ·   ");
    page.drawText(catLabels, { x: MARGIN, y, font: bold, size: 13, color: DARK });
    y -= 32;

    page.drawText("TOTAL PHOTOS", { x: MARGIN, y, font: bold, size: 8, color: GRAY });
    y -= 16;
    page.drawText(String(orderedPhotos.length), { x: MARGIN, y, font: bold, size: 13, color: DARK });
    y -= 32;

    page.drawText("DATE GENERATED", { x: MARGIN, y, font: bold, size: 8, color: GRAY });
    y -= 16;
    page.drawText(fmtDate(new Date().toISOString()), { x: MARGIN, y, font: bold, size: 13, color: DARK });
    y -= 32;

    if (bp?.owner_name) {
      page.drawText("PREPARED BY", { x: MARGIN, y, font: bold, size: 8, color: GRAY });
      y -= 16;
      page.drawText(bp.owner_name, { x: MARGIN, y, font: bold, size: 13, color: DARK });
    }
  }

  // ── PHOTO PAGES ────────────────────────────────────────────────────────────
  // Layout: 2 photos per page, each with metadata below
  const USABLE_TOP    = PAGE_H - HEADER_H - 12;
  const USABLE_BOTTOM = FOOTER_H + 12;
  const USABLE_H      = USABLE_TOP - USABLE_BOTTOM;
  const GAP           = 20;
  const INFO_H        = 52;
  const PHOTO_H       = Math.floor((USABLE_H - GAP) / 2 - INFO_H);

  let currentCat: PhotoCategory | null = null;

  for (let i = 0; i < embeddedPhotos.length; i += 2) {
    const pair = embeddedPhotos.slice(i, i + 2);

    // Category section header page if category changes
    const thisCat = pair[0].photo.category;
    if (selectedCategories.length > 1 && thisCat !== currentCat) {
      currentCat = thisCat;
      const sepPage = addPage();
      await drawHeader(sepPage, pdfDoc, bold, reg, bp, logoImg);

      // Centered category label
      const label = categoryLabel(thisCat).toUpperCase();
      const labelW = bold.widthOfTextAtSize(label, 32);
      sepPage.drawText(label, {
        x: PAGE_W / 2 - labelW / 2,
        y: PAGE_H / 2,
        font: bold, size: 32, color: DARK,
      });
      sepPage.drawLine({
        start: { x: PAGE_W / 2 - 30, y: PAGE_H / 2 - 12 },
        end: { x: PAGE_W / 2 + 30, y: PAGE_H / 2 - 12 },
        thickness: 3, color: ORANGE,
      });

      const countStr = `${photos.filter(p => p.category === thisCat).length} photos`;
      const countW = reg.widthOfTextAtSize(countStr, 12);
      sepPage.drawText(countStr, {
        x: PAGE_W / 2 - countW / 2,
        y: PAGE_H / 2 - 32,
        font: reg, size: 12, color: GRAY,
      });
    }

    const page = addPage();
    await drawHeader(page, pdfDoc, bold, reg, bp, logoImg);

    for (let slot = 0; slot < pair.length; slot++) {
      const { photo, img } = pair[slot];
      const slotTopY = USABLE_TOP - slot * (PHOTO_H + INFO_H + GAP);
      const imgY     = slotTopY - PHOTO_H;
      const infoY    = imgY - INFO_H;

      // Orange category pill top-left of image area
      const catLabel = categoryLabel(photo.category);
      const catPillW = bold.widthOfTextAtSize(catLabel, 8) + 12;
      page.drawRectangle({ x: MARGIN, y: slotTopY - 22, width: catPillW, height: 18, color: ORANGE });
      page.drawText(catLabel, { x: MARGIN + 6, y: slotTopY - 17, font: bold, size: 8, color: WHITE });

      if (img) {
        // Scale image to fit CONTENT_W × PHOTO_H preserving aspect ratio
        const ratio = img.width / img.height;
        let drawW = CONTENT_W;
        let drawH = CONTENT_W / ratio;
        if (drawH > PHOTO_H) {
          drawH = PHOTO_H;
          drawW = PHOTO_H * ratio;
        }
        const drawX = MARGIN + (CONTENT_W - drawW) / 2;
        page.drawImage(img, { x: drawX, y: imgY, width: drawW, height: drawH });
      } else {
        // Placeholder
        page.drawRectangle({ x: MARGIN, y: imgY, width: CONTENT_W, height: PHOTO_H, color: LGRAY });
        const noImgW = reg.widthOfTextAtSize("Image unavailable", 10);
        page.drawText("Image unavailable", {
          x: MARGIN + CONTENT_W / 2 - noImgW / 2,
          y: imgY + PHOTO_H / 2 - 5,
          font: reg, size: 10, color: GRAY,
        });
      }

      // Metadata below image
      const ts = photo.taken_at ?? photo.created_at;
      page.drawText(fmtFull(ts), {
        x: MARGIN, y: infoY + 32,
        font: bold, size: 9, color: DARK,
      });

      if (photo.lat !== null && photo.lng !== null) {
        const coordStr = `${photo.lat.toFixed(6)}, ${photo.lng.toFixed(6)}`;
        page.drawText(coordStr, { x: MARGIN, y: infoY + 18, font: reg, size: 8, color: GRAY });
        if (photo.accuracy !== null) {
          const accStr = `±${Math.round(photo.accuracy * 3.281)} ft accuracy`;
          page.drawText(accStr, { x: MARGIN, y: infoY + 6, font: reg, size: 8, color: GRAY });
        }
      } else {
        page.drawText("Location unavailable", { x: MARGIN, y: infoY + 18, font: reg, size: 8, color: LGRAY });
      }

      // Separator between photos
      if (slot === 0 && pair.length === 2) {
        const sepY = imgY - INFO_H - GAP / 2;
        page.drawLine({ start: { x: MARGIN, y: sepY }, end: { x: COL_R, y: sepY }, thickness: 0.5, color: LGRAY });
      }
    }
  }

  // ── SUPPORTING DOCUMENTS INDEX ─────────────────────────────────────────────
  if (data.documents && data.documents.length > 0) {
    const docsPage = addPage();
    await drawHeader(docsPage, pdfDoc, bold, reg, bp, logoImg);

    let dy = PAGE_H - HEADER_H - 48;
    docsPage.drawText("SUPPORTING DOCUMENTS", { x: MARGIN, y: dy, font: bold, size: 18, color: DARK });
    dy -= 8;
    docsPage.drawLine({ start: { x: MARGIN, y: dy }, end: { x: COL_R, y: dy }, thickness: 3, color: ORANGE });
    dy -= 28;

    const DOC_ROW_H = 36;
    for (const doc of data.documents) {
      if (dy < FOOTER_H + 40) break; // don't overflow into footer

      docsPage.drawRectangle({ x: MARGIN, y: dy - DOC_ROW_H + 8, width: CONTENT_W, height: DOC_ROW_H, color: rgb(0.1, 0.1, 0.1) });

      docsPage.drawText(doc.name, {
        x: MARGIN + 12, y: dy - 8,
        font: bold, size: 10, color: WHITE,
      });

      const catStr = doc.category.charAt(0).toUpperCase() + doc.category.slice(1);
      const dateStr = new Date(doc.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const metaStr = `${catStr} · ${dateStr}`;
      docsPage.drawText(metaStr, {
        x: MARGIN + 12, y: dy - 22,
        font: reg, size: 8, color: GRAY,
      });

      dy -= DOC_ROW_H + 6;
    }
  }

  // ── DRAW FOOTERS (now that we know total page count) ───────────────────────
  const totalPages = pages.length;
  for (let i = 0; i < pages.length; i++) {
    drawFooter(pages[i], bold, reg, businessName, jobName, i + 1, totalPages);
  }

  // ── DOWNLOAD ───────────────────────────────────────────────────────────────
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = jobName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  a.href = url;
  a.download = `photo-report-${safeName}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
