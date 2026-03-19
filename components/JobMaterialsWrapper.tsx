"use client";

import { useState } from "react";
import { Material } from "@/types";
import MaterialsSection from "./MaterialsSection";
import EstimationSuggestions from "./EstimationSuggestions";

interface Props {
  jobId: string;
  jobName?: string;
  jobTypes: string[];
  calculatedSqft: number | null;
  initialMaterials: Material[];
  completedJobCount: number;
}

export default function JobMaterialsWrapper({
  jobId,
  jobName = "",
  jobTypes,
  calculatedSqft,
  initialMaterials,
  completedJobCount,
}: Props) {
  const [materials, setMaterials] = useState<Material[]>(initialMaterials);

  function handleSuggestionApplied(newMaterials: Material[]) {
    setMaterials((prev) => [...newMaterials, ...prev]);
  }

  return (
    <>
      {completedJobCount >= 3 && (
        <EstimationSuggestions
          jobId={jobId}
          jobTypes={jobTypes}
          calculatedSqft={calculatedSqft}
          completedJobCount={completedJobCount}
          onMaterialsAdded={handleSuggestionApplied}
        />
      )}
      <MaterialsSection
        jobId={jobId}
        jobName={jobName}
        initialMaterials={materials}
        onMaterialsAdded={handleSuggestionApplied}
      />
    </>
  );
}
