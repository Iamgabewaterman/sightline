"use client";

import { createContext, useContext, useState } from "react";
import { QuoteAddon } from "@/types";

export interface QuoteState {
  materialBudget: number;
  laborBudget: number;
  profitMarginPct: number;
  finalQuote: number;
  addons: QuoteAddon[];
}

interface JobCostContextType {
  actualMaterialCost: number;
  actualLaborCost: number;
  setActualMaterialCost: (cost: number) => void;
  setActualLaborCost: (cost: number) => void;
  quoteData: QuoteState | null;
  setQuoteData: (data: QuoteState | null) => void;
}

const JobCostContext = createContext<JobCostContextType>({
  actualMaterialCost: 0,
  actualLaborCost: 0,
  setActualMaterialCost: () => {},
  setActualLaborCost: () => {},
  quoteData: null,
  setQuoteData: () => {},
});

export function JobCostProvider({
  children,
  initialMaterialCost,
  initialLaborCost,
  initialQuoteData,
}: {
  children: React.ReactNode;
  initialMaterialCost: number;
  initialLaborCost: number;
  initialQuoteData?: QuoteState | null;
}) {
  const [actualMaterialCost, setActualMaterialCost] = useState(initialMaterialCost);
  const [actualLaborCost, setActualLaborCost] = useState(initialLaborCost);
  const [quoteData, setQuoteData] = useState<QuoteState | null>(initialQuoteData ?? null);

  return (
    <JobCostContext.Provider
      value={{
        actualMaterialCost,
        actualLaborCost,
        setActualMaterialCost,
        setActualLaborCost,
        quoteData,
        setQuoteData,
      }}
    >
      {children}
    </JobCostContext.Provider>
  );
}

export function useJobCost() {
  return useContext(JobCostContext);
}
