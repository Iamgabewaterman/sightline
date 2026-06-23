"use client";

import { createContext, useContext } from "react";
import type { ResultItem } from "@/app/(dashboard)/calculator/calcs/types";

export interface CalcAddHandler {
  // When provided, CalcOutput shows a single button (label) that calls this with
  // the calculated items instead of the standalone job-picker flow.
  onAddResult: (items: ResultItem[], tradeLabel: string) => Promise<void> | void;
  addLabel: string;
}

const CalcAddContext = createContext<CalcAddHandler | null>(null);

export function CalcAddProvider({
  handler,
  children,
}: {
  handler: CalcAddHandler;
  children: React.ReactNode;
}) {
  return <CalcAddContext.Provider value={handler}>{children}</CalcAddContext.Provider>;
}

export function useCalcAdd(): CalcAddHandler | null {
  return useContext(CalcAddContext);
}
