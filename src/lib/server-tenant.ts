import { fetchQuery } from "convex/nextjs";
import { api } from "../../convex/_generated/api";
import { fallbackTenantSlug, getTenantHostResolution } from "@/lib/tenant-resolver";

export type ResolvedTenant =
  | {
      ok: true;
      tenant: {
        slug: string;
        name: string;
      };
      source: "slug" | "custom" | "fallback";
    }
  | {
      ok: false;
      reason: "root" | "not_found";
      requestedTenantSlug?: string;
      requestedHost?: string;
    };

export async function resolveTenantForRequest(
  searchParams?: URLSearchParams,
  options: { fallbackToDefault?: boolean } = {}
): Promise<ResolvedTenant> {
  const hostResolution = await getTenantHostResolution(searchParams);

  if (hostResolution.kind === "slug") {
    const tenant = await fetchQuery(api.tenants.getBySlug, {
      slug: hostResolution.tenantSlug,
    });

    return tenant
      ? { ok: true, tenant: { slug: tenant.slug, name: tenant.name }, source: "slug" }
      : {
          ok: false,
          reason: "not_found",
          requestedTenantSlug: hostResolution.tenantSlug,
        };
  }

  if (hostResolution.kind === "custom") {
    const tenant = await fetchQuery(api.tenants.getByCustomDomain, {
      customDomain: hostResolution.customHost,
    });

    return tenant
      ? { ok: true, tenant: { slug: tenant.slug, name: tenant.name }, source: "custom" }
      : {
          ok: false,
          reason: "not_found",
          requestedHost: hostResolution.customHost,
        };
  }

  if (!options.fallbackToDefault) {
    return { ok: false, reason: "root" };
  }

  const tenantSlug = fallbackTenantSlug(searchParams?.get("tenant"));
  const tenant = await fetchQuery(api.tenants.getBySlug, { slug: tenantSlug });

  return tenant
    ? { ok: true, tenant: { slug: tenant.slug, name: tenant.name }, source: "fallback" }
    : { ok: false, reason: "not_found", requestedTenantSlug: tenantSlug };
}
