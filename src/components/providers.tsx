"use client";

import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

function useWorkOSConvexAuth() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const fetchAccessToken = useCallback(async () => {
    const response = await fetch("/api/auth/convex-token", {
      cache: "no-store",
      credentials: "same-origin",
    });

    if (!response.ok) {
      setIsAuthenticated(false);
      return null;
    }

    const { token } = (await response.json()) as { token?: string | null };
    const hasToken = Boolean(token);

    setIsAuthenticated(hasToken);
    return token ?? null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      setIsLoading(true);

      try {
        const response = await fetch("/api/auth/convex-token", {
          cache: "no-store",
          credentials: "same-origin",
        });

        if (!response.ok) {
          if (!cancelled) setIsAuthenticated(false);
          return;
        }

        const { token } = (await response.json()) as { token?: string | null };

        if (!cancelled) {
          setIsAuthenticated(Boolean(token));
        }
      } catch {
        if (!cancelled) setIsAuthenticated(false);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(
    () => ({
      isLoading,
      isAuthenticated,
      fetchAccessToken,
    }),
    [isLoading, isAuthenticated, fetchAccessToken],
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const convex = useMemo(
    () => (convexUrl ? new ConvexReactClient(convexUrl) : null),
    [convexUrl],
  );

  if (!convex) return <>{children}</>;

  return (
    <ConvexProviderWithAuth client={convex} useAuth={useWorkOSConvexAuth}>
      {children}
    </ConvexProviderWithAuth>
  );
}