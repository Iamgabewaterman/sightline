"use server";

import { detectFileType } from "@/lib/detect-file-type";
import { detectPlatform } from "@/lib/detect-platform";

export interface DemoImportPreviewResult {
  fileName: string;
  platform: string;
  detectedType: string;
  rowCount: number;
  headers: string[];
  sampleRows: Record<string, string>[];
  organized: {
    clients: number;
    jobs: number;
    materials: number;
    labor: number;
    expenses: number;
  };
}

export async function demoImportPreview(
  fileName: string,
  headers: string[],
  rows: Record<string, string>[],
): Promise<DemoImportPreviewResult> {
  const detectedType = detectFileType(headers);
  const { platform } = detectPlatform(headers);

  // Estimate organized counts without actually writing to DB
  const organized = {
    clients: detectedType === "clients" ? rows.length : 0,
    jobs: detectedType === "jobs" ? rows.length : 0,
    materials: detectedType === "materials" ? rows.length : 0,
    labor: detectedType === "labor" ? rows.length : 0,
    expenses: detectedType === "expenses" ? rows.length : 0,
  };

  return {
    fileName,
    platform,
    detectedType,
    rowCount: rows.length,
    headers,
    sampleRows: rows.slice(0, 5),
    organized,
  };
}
