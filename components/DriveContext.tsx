"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Drive } from "@/types";
import { getActiveDrive } from "@/app/actions/drives";

interface DriveContextValue {
  activeDrive: Drive | null;
  setActiveDrive: (d: Drive | null) => void;
}

const DriveContext = createContext<DriveContextValue | null>(null);

export function DriveProvider({ children }: { children: React.ReactNode }) {
  const [activeDrive, setActiveDrive] = useState<Drive | null>(null);

  useEffect(() => {
    getActiveDrive().then(setActiveDrive);
  }, []);

  const set = useCallback((d: Drive | null) => setActiveDrive(d), []);

  return (
    <DriveContext.Provider value={{ activeDrive, setActiveDrive: set }}>
      {children}
    </DriveContext.Provider>
  );
}

export function useDriveContext() {
  const ctx = useContext(DriveContext);
  if (!ctx) throw new Error("useDriveContext must be used inside DriveProvider");
  return ctx;
}
