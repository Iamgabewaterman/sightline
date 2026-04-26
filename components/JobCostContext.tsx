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
  actualReceiptTotal: number;
  setActualMaterialCost: (cost: number) => void;
  setActualLaborCost: (cost: number) => void;
  setActualSubCost: (cost: number) => void;
  setActualReceiptTotal: (total: number) => void;
  quoteData: QuoteState | null;
  setQuoteData: (data: QuoteState | null) => void;
  changeOrders: ChangeOrder[];
  setChangeOrders: (orders: ChangeOrder[]) => void;
  // Quick-add triggers (sections listen and react)
  openMaterialForm: boolean;
  setOpenMaterialForm: (v: boolean) => void;
  openLaborForm: boolean;
  setOpenLaborForm: (v: boolean) => void;
  highlightReceiptScan: boolean;
  setHighlightReceiptScan: (v: boolean) => void;
}

const JobCostContext = createContext<JobCostContextType>({
  actualMaterialCost: 0,
  actualLaborCost: 0,
  actualSubCost: 0,
  actualReceiptTotal: 0,
  setActualMaterialCost: () => {},
  setActualLaborCost: () => {},
  setActualSubCost: () => {},
  setActualReceiptTotal: () => {},
  quoteData: null,
  setQuoteData: () => {},
  changeOrders: [],
  setChangeOrders: () => {},
  openMaterialForm: false,
  setOpenMaterialForm: () => {},
  openLaborForm: false,
  setOpenLaborForm: () => {},
  highlightReceiptScan: false,
  setHighlightReceiptScan: () => {},
});

export function JobCostProvider({
  children,
  initialMaterialCost,
  initialLaborCost,
  initialSubCost,
  initialReceiptTotal,
  initialQuoteData,
  initialChangeOrders,
}: {
  children: React.ReactNode;
  initialMaterialCost: number;
  initialLaborCost: number;
  initialSubCost?: number;
  initialReceiptTotal?: number;
  initialQuoteData?: QuoteState | null;
  initialChangeOrders?: ChangeOrder[];
}) {
  const [actualMaterialCost, setActualMaterialCost] = useState(initialMaterialCost);
  const [actualLaborCost, setActualLaborCost] = useState(initialLaborCost);
  const [actualSubCost, setActualSubCost] = useState(initialSubCost ?? 0);
  const [actualReceiptTotal, setActualReceiptTotal] = useState(initialReceiptTotal ?? 0);
  const [quoteData, setQuoteData] = useState<QuoteState | null>(initialQuoteData ?? null);
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>(initialChangeOrders ?? []);
  const [openMaterialForm, setOpenMaterialForm] = useState(false);
  const [openLaborForm, setOpenLaborForm] = useState(false);
  const [highlightReceiptScan, setHighlightReceiptScan] = useState(false);

  return (
    <JobCostContext.Provider
      value={{
        actualMaterialCost,
        actualLaborCost,
        actualSubCost,
        actualReceiptTotal,
        setActualMaterialCost,
        setActualLaborCost,
        setActualSubCost,
        setActualReceiptTotal,
        quoteData,
        setQuoteData,
        changeOrders,
        setChangeOrders,
        openMaterialForm,
        setOpenMaterialForm,
        openLaborForm,
        setOpenLaborForm,
        highlightReceiptScan,
        setHighlightReceiptScan,
      }}
    >
      {children}
    </JobCostContext.Provider>
  );
}

export function useJobCost() {
  return useContext(JobCostContext);
}
