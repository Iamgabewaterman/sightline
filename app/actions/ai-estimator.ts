"use server";

import Anthropic from "@anthropic-ai/sdk";

export interface AIEstimatorResult {
  detected_project_type: string;
  confidence: "low" | "medium" | "high";
  materials_identified: {
    name: string;
    category: string;
    unit: string;
    notes: string;
    quantity_math?: string;
  }[];
  measurements_needed: string[];
  ai_notes: string;
}

export async function analyzeProjectPhotos(
  photoDataUrls: string[],
  description: string
): Promise<{ result?: AIEstimatorResult; error?: string }> {
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Build image blocks from data URLs
    type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    const imageBlocks: Anthropic.ImageBlockParam[] = photoDataUrls.map((dataUrl) => {
      const commaIdx = dataUrl.indexOf(",");
      const header = dataUrl.substring(0, commaIdx); // e.g. "data:image/jpeg;base64"
      const base64Data = dataUrl.substring(commaIdx + 1);
      const mimeMatch = header.match(/data:([^;]+);/);
      const mediaType: ImageMediaType = (mimeMatch ? mimeMatch[1] : "image/jpeg") as ImageMediaType;

      return {
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType,
          data: base64Data,
        },
      };
    });

    const textBlock: Anthropic.TextBlockParam = {
      type: "text",
      text: description
        ? `Project description: ${description}`
        : "Please analyze this construction project.",
    };

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: `You are an expert contractor and construction estimator with 20 years of experience. Analyze the provided photo or photos of a construction or renovation project.

Count every distinct visible element: boards, sheets, tiles, fixtures, outlets, windows, doors, columns, or any discrete countable item. Use these counts to inform your quantity_math notes.

For each material identify:
- name: specific (e.g. "2×6 SPF framing studs" not just "lumber")
- category: exactly one of — Lumber and Framing, Sheet Goods, Roofing, Concrete and Masonry, Plumbing and Piping, Electrical and Conduit, Hardware and Fasteners, Insulation, Finishing, Flooring, Siding, Drywall, Paint, Other
- unit: ordering unit (sqft, LF, each, sheet, square, gallon, bag)
- quantity_math: brief formula using the measurements_needed fields (e.g. "wall area / 32 sqft per sheet × 1.10 waste")
- notes: specific brand, grade, or spec the contractor should know

Output only valid JSON with no markdown, no explanation, no preamble:
{ "detected_project_type": string, "confidence": "low" or "medium" or "high", "materials_identified": [ { "name": string, "category": string, "unit": string, "quantity_math": string, "notes": string } ], "measurements_needed": [ string ], "ai_notes": string }

measurements_needed must list every dimension required — be specific: "Room length in feet", "Room width in feet", "Wall height in feet", "Number of doors", "Linear feet of baseboard".

Confidence: "high" = project type obvious, all materials clearly visible; "medium" = some materials inferred or partial photo coverage; "low" = unclear photo, unusual project, or materials hidden.

ai_notes: one honest sentence about accuracy limits (e.g. "Slab thickness not visible — depth assumed 4 inches").`,
      messages: [
        {
          role: "user",
          content: [...imageBlocks, textBlock],
        },
      ],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text.trim() : "";

    const cleaned = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      return { error: "No materials detected. Try a clearer photo with better lighting, or add a description." };
    }

    try {
      const parsed: AIEstimatorResult = JSON.parse(match[0]);
      return { result: parsed };
    } catch {
      return { error: "Could not read AI response. Please try again." };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { error: message };
  }
}
