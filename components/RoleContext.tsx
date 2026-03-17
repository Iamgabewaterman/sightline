"use client";

import { createContext, useContext } from "react";

export interface RoleData {
  role: "owner" | "field_member";
  can_see_financials: boolean;
  can_see_all_jobs: boolean;
  can_see_client_info: boolean;
}

const defaultRole: RoleData = {
  role: "owner",
  can_see_financials: true,
  can_see_all_jobs: true,
  can_see_client_info: true,
};

const RoleContext = createContext<RoleData>(defaultRole);

export function RoleProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: RoleData;
}) {
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleData {
  return useContext(RoleContext);
}
