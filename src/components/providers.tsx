"use client";

import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { type ReactNode, useCallback, useMemo } from "react";

function useWorkOSConvexAuth() {
  const fetchAccessToken = useCallback(async () => {
    const response = await fetch("/api/auth/convex-token", { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    const { token } = (await response.json()) as { token?: string };
    return token ?? null;
  }, []);

  return useMemo(
    () => ({
      isLoading: false,
      isAuthenticated: true,
      fetchAccessToken,
    }),
    [fetchAccessToken],
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const convex = useMemo(() => (convexUrl ? new ConvexReactClient(convexUrl) : null), [convexUrl]);

  if (!convex) return <>{children}</>;

  return (
    <ConvexProviderWithAuth client={convex} useAuth={useWorkOSConvexAuth}>
      {children}
    </ConvexProviderWithAuth>
  );
}
