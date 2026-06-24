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
  openCalcDrawer: boolean;
  setOpenCalcDrawer: (v: boolean) => void;
  photoTrigger: number;
  triggerPhoto: () => void;
  quoteTrigger: number;
  triggerQuote: () => void;
  // Request a collapsed section (by id) to expand — value increments per request
  openRequests: Record<string, number>;
  requestOpen: (sectionId: string) => void;
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
  openCalcDrawer: false,
  setOpenCalcDrawer: () => {},
  photoTrigger: 0,
  triggerPhoto: () => {},
  quoteTrigger: 0,
  triggerQuote: () => {},
  openRequests: {},
  requestOpen: () => {},
});

export function JobCostProvider({
  children,
  initialMaterialCost,
  initialLaborCost,
  initialSubCost,
  initialReceiptTotal,
  initialQuoteData,
  initialChangeOrders,
  initialOpenMaterialForm,
  initialOpenLaborForm,
}: {
  children: React.ReactNode;
  initialMaterialCost: number;
  initialLaborCost: number;
  initialSubCost?: number;
  initialReceiptTotal?: number;
  initialQuoteData?: QuoteState | null;
  initialChangeOrders?: ChangeOrder[];
  initialOpenMaterialForm?: boolean;
  initialOpenLaborForm?: boolean;
}) {
  const [actualMaterialCost, setActualMaterialCost] = useState(initialMaterialCost);
  const [actualLaborCost, setActualLaborCost] = useState(initialLaborCost);
  const [actualSubCost, setActualSubCost] = useState(initialSubCost ?? 0);
  const [actualReceiptTotal, setActualReceiptTotal] = useState(initialReceiptTotal ?? 0);
  const [quoteData, setQuoteData] = useState<QuoteState | null>(initialQuoteData ?? null);
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>(initialChangeOrders ?? []);
  const [openMaterialForm, setOpenMaterialForm] = useState(initialOpenMaterialForm ?? false);
  const [openLaborForm, setOpenLaborForm] = useState(initialOpenLaborForm ?? false);
  const [highlightReceiptScan, setHighlightReceiptScan] = useState(false);
  const [openCalcDrawer, setOpenCalcDrawer] = useState(false);
  const [photoTrigger, setPhotoTrigger] = useState(0);
  const [quoteTrigger, setQuoteTrigger] = useState(0);
  const [openRequests, setOpenRequests] = useState<Record<string, number>>({});
  const triggerPhoto = () => setPhotoTrigger((n) => n + 1);
  const triggerQuote = () => setQuoteTrigger((n) => n + 1);
  const requestOpen = (sectionId: string) =>
    setOpenRequests((prev) => ({ ...prev, [sectionId]: (prev[sectionId] ?? 0) + 1 }));

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
        openCalcDrawer,
        setOpenCalcDrawer,
        photoTrigger,
        triggerPhoto,
        quoteTrigger,
        triggerQuote,
        openRequests,
        requestOpen,
      }}
    >
      {children}
    </JobCostContext.Provider>
  );
}

export function useJobCost() {
  return useContext(JobCostContext);
}
