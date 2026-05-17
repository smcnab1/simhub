"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { tenantAwareHref } from "@/lib/tenant-url";

function subscribeHost() {
  return () => {};
}

function clientHostSnapshot() {
  return window.location.host;
}

function serverHostSnapshot() {
  return null;
}

export function useTenantLink(selectedTenantSlug?: string | null) {
  const searchParams = useSearchParams();
  const tenantFromQuery = searchParams.get("tenant");
  const host = useSyncExternalStore(
    subscribeHost,
    clientHostSnapshot,
    serverHostSnapshot
  );

  return useMemo(
    () => (path: string) =>
      tenantAwareHref(path, {
        host,
        tenantFromQuery,
        selectedTenantSlug,
      }),
    [host, selectedTenantSlug, tenantFromQuery]
  );
}
