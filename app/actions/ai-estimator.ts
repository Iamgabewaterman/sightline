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
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system:
        'You are an expert contractor and construction estimator with 20 years of experience. Analyze the provided photo or photos of a construction or renovation project. Identify every material visible or implied by the project type. For each material identify: the material category from this list — Lumber and Framing, Sheet Goods, Roofing, Concrete and Masonry, Plumbing and Piping, Electrical and Conduit, Hardware and Fasteners, Insulation, Finishing, Flooring, Siding, Drywall, Paint, and Other. Output only valid JSON with no markdown, no explanation, and no preamble in this exact format: { "detected_project_type": string, "confidence": "low" or "medium" or "high", "materials_identified": [ { "name": string, "category": string, "unit": string, "notes": string } ], "measurements_needed": [ string ], "ai_notes": string }. The measurements_needed array should list every measurement the contractor needs to provide to calculate quantities — for example "Room length in feet", "Room width in feet", "Wall height in feet", "Number of doors", "Linear feet of baseboard". Be specific and practical. The ai_notes field should contain one sentence of honest context about the estimate accuracy.',
      messages: [
        {
          role: "user",
          content: [...imageBlocks, textBlock],
        },
      ],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    const parsed: AIEstimatorResult = JSON.parse(rawText);
    return { result: parsed };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { error: message };
  }
}
