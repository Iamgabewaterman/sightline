"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ClockSession } from "@/types";
import { getActiveSession } from "@/app/actions/clock";

interface ClockContextValue {
  activeSession: ClockSession | null;
  setActiveSession: (s: ClockSession | null) => void;
  clockInOpen: boolean;
  openClockIn: () => void;
  closeClockIn: () => void;
}

const ClockContext = createContext<ClockContextValue | null>(null);

export function ClockProvider({ children }: { children: React.ReactNode }) {
  const [activeSession, setActiveSession] = useState<ClockSession | null>(null);
  const [clockInOpen, setClockInOpen] = useState(false);

  useEffect(() => {
    getActiveSession().then(setActiveSession);
  }, []);

  const openClockIn = useCallback(() => setClockInOpen(true), []);
  const closeClockIn = useCallback(() => setClockInOpen(false), []);

  return (
    <ClockContext.Provider value={{ activeSession, setActiveSession, clockInOpen, openClockIn, closeClockIn }}>
      {children}
    </ClockContext.Provider>
  );
}

export function useClockContext() {
  const ctx = useContext(ClockContext);
  if (!ctx) throw new Error("useClockContext must be used inside ClockProvider");
  return ctx;
}
