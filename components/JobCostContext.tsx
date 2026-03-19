"use client";

import { createContext, useContext, useState } from "react";
import { QuoteAddon, ChangeOrder } from "@/types";

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
  actualSubCost: number;
  setActualMaterialCost: (cost: number) => void;
  setActualLaborCost: (cost: number) => void;
  setActualSubCost: (cost: number) => void;
  quoteData: QuoteState | null;
  setQuoteData: (data: QuoteState | null) => void;
  changeOrders: ChangeOrder[];
  setChangeOrders: (orders: ChangeOrder[]) => void;
}

const JobCostContext = createContext<JobCostContextType>({
  actualMaterialCost: 0,
  actualLaborCost: 0,
  actualSubCost: 0,
  setActualMaterialCost: () => {},
  setActualLaborCost: () => {},
  setActualSubCost: () => {},
  quoteData: null,
  setQuoteData: () => {},
  changeOrders: [],
  setChangeOrders: () => {},
});

export function JobCostProvider({
  children,
  initialMaterialCost,
  initialLaborCost,
  initialSubCost,
  initialQuoteData,
  initialChangeOrders,
}: {
  children: React.ReactNode;
  initialMaterialCost: number;
  initialLaborCost: number;
  initialSubCost?: number;
  initialQuoteData?: QuoteState | null;
  initialChangeOrders?: ChangeOrder[];
}) {
  const [actualMaterialCost, setActualMaterialCost] = useState(initialMaterialCost);
  const [actualLaborCost, setActualLaborCost] = useState(initialLaborCost);
  const [actualSubCost, setActualSubCost] = useState(initialSubCost ?? 0);
  const [quoteData, setQuoteData] = useState<QuoteState | null>(initialQuoteData ?? null);
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>(initialChangeOrders ?? []);

  return (
    <JobCostContext.Provider
      value={{
        actualMaterialCost,
        actualLaborCost,
        actualSubCost,
        setActualMaterialCost,
        setActualLaborCost,
        setActualSubCost,
        quoteData,
        setQuoteData,
        changeOrders,
        setChangeOrders,
      }}
    >
      {children}
    </JobCostContext.Provider>
  );
}

export function useJobCost() {
  return useContext(JobCostContext);
}
