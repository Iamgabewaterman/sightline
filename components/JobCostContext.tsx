"use client";

import { createContext, useContext, useState } from "react";

interface JobCostContextType {
  actualMaterialCost: number;
  actualLaborCost: number;
  setActualMaterialCost: (cost: number) => void;
  setActualLaborCost: (cost: number) => void;
}

const JobCostContext = createContext<JobCostContextType>({
  actualMaterialCost: 0,
  actualLaborCost: 0,
  setActualMaterialCost: () => {},
  setActualLaborCost: () => {},
});

export function JobCostProvider({
  children,
  initialMaterialCost,
  initialLaborCost,
}: {
  children: React.ReactNode;
  initialMaterialCost: number;
  initialLaborCost: number;
}) {
  const [actualMaterialCost, setActualMaterialCost] = useState(initialMaterialCost);
  const [actualLaborCost, setActualLaborCost] = useState(initialLaborCost);
  return (
    <JobCostContext.Provider
      value={{ actualMaterialCost, actualLaborCost, setActualMaterialCost, setActualLaborCost }}
    >
      {children}
    </JobCostContext.Provider>
  );
}

export function useJobCost() {
  return useContext(JobCostContext);
}
