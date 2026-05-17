import { headers } from "next/headers";
import { tenantAwareHref } from "@/lib/tenant-url";

export async function getTenantAwareLinkFor({
  tenantFromQuery,
  selectedTenantSlug,
}: {
  tenantFromQuery?: string | null;
  selectedTenantSlug?: string | null;
} = {}) {
  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ??
    headerStore.get("host") ??
    "";

  return (path: string) =>
    tenantAwareHref(path, {
      host,
      tenantFromQuery,
      selectedTenantSlug,
    });
}
