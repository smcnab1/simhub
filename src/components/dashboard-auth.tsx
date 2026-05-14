"use client";

import { createContext, type ReactNode, useContext } from "react";

export type DashboardAuth = {
  tenantSlug: string;
  tenantName?: string;
  role?: "Admin" | "Staff" | "Requester";
  memberships?: Array<{
    tenantName: string;
    tenantSlug: string;
    role: "Admin" | "Staff" | "Requester";
  }>;
  workosUserId?: string;
  email?: string;
  workosOrganizationId?: string;
};

const DashboardAuthContext = createContext<DashboardAuth | null>(null);

export function DashboardAuthProvider({
  auth,
  children,
}: {
  auth: DashboardAuth;
  children: ReactNode;
}) {
  return (
    <DashboardAuthContext.Provider value={auth}>
      {children}
    </DashboardAuthContext.Provider>
  );
}

export function useDashboardAuth() {
  const auth = useContext(DashboardAuthContext);

  if (!auth) {
    throw new Error("Dashboard auth context is missing.");
  }

  return auth;
}

export function useOptionalDashboardAuth() {
  return useContext(DashboardAuthContext);
}
