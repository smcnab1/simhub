import { fetchQuery } from "convex/nextjs";
import { api } from "../../convex/_generated/api";
import { fallbackTenantSlug, getTenantHostResolution } from "@/lib/tenant-resolver";

type PublicTenant = {
  slug: string;
  name: string;
  active: boolean;
} | null;

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

function logTenantResolution(event: {
  host: string;
  tenantSlug?: string | null;
  found?: boolean;
  active?: boolean | null;
  functionName?: string;
  error?: unknown;
}) {
  console.info("[tenant-resolution]", {
    host: event.host,
    tenantSlug: event.tenantSlug ?? null,
    found: event.found,
    active: event.active,
    convexFunction: event.functionName,
  });

  if (event.error) {
    console.error("[tenant-resolution] Convex tenant lookup failed", event.error);
  }
}

async function fetchPublicTenant(
  functionName: "tenants.getPublicTenantBySlug" | "tenants.getPublicTenantByCustomDomain",
  args: { slug: string } | { customDomain: string }
): Promise<PublicTenant> {
  if (functionName === "tenants.getPublicTenantBySlug") {
    return await fetchQuery(api.tenants.getPublicTenantBySlug, args as { slug: string });
  }

  return await fetchQuery(
    api.tenants.getPublicTenantByCustomDomain,
    args as { customDomain: string }
  );
}

export async function resolveTenantForRequest(
  searchParams?: URLSearchParams,
  options: { fallbackToDefault?: boolean } = {}
): Promise<ResolvedTenant> {
  const hostResolution = await getTenantHostResolution(searchParams);

  if (hostResolution.kind === "slug") {
    const functionName = "tenants.getPublicTenantBySlug" as const;

    try {
      const tenant = await fetchPublicTenant(functionName, {
        slug: hostResolution.tenantSlug,
      });

      logTenantResolution({
        host: hostResolution.host,
        tenantSlug: hostResolution.tenantSlug,
        found: !!tenant,
        active: tenant?.active ?? null,
        functionName,
      });

      return tenant?.active
        ? { ok: true, tenant: { slug: tenant.slug, name: tenant.name }, source: "slug" }
        : {
            ok: false,
            reason: "not_found",
            requestedTenantSlug: hostResolution.tenantSlug,
          };
    } catch (error) {
      logTenantResolution({
        host: hostResolution.host,
        tenantSlug: hostResolution.tenantSlug,
        functionName,
        error,
      });
      return {
        ok: false,
        reason: "not_found",
        requestedTenantSlug: hostResolution.tenantSlug,
      };
    }
  }

  if (hostResolution.kind === "custom") {
    const functionName = "tenants.getPublicTenantByCustomDomain" as const;

    try {
      const tenant = await fetchPublicTenant(functionName, {
        customDomain: hostResolution.customHost,
      });

      logTenantResolution({
        host: hostResolution.host,
        tenantSlug: tenant?.slug,
        found: !!tenant,
        active: tenant?.active ?? null,
        functionName,
      });

      return tenant?.active
        ? { ok: true, tenant: { slug: tenant.slug, name: tenant.name }, source: "custom" }
        : {
            ok: false,
            reason: "not_found",
            requestedHost: hostResolution.customHost,
          };
    } catch (error) {
      logTenantResolution({
        host: hostResolution.host,
        functionName,
        error,
      });
      return {
        ok: false,
        reason: "not_found",
        requestedHost: hostResolution.customHost,
      };
    }
  }

  if (!options.fallbackToDefault) {
    return { ok: false, reason: "root" };
  }

  const tenantSlug = fallbackTenantSlug(searchParams?.get("tenant"));
  const functionName = "tenants.getPublicTenantBySlug" as const;

  try {
    const tenant = await fetchPublicTenant(functionName, { slug: tenantSlug });

    logTenantResolution({
      host: hostResolution.host,
      tenantSlug,
      found: !!tenant,
      active: tenant?.active ?? null,
      functionName,
    });

    return tenant?.active
      ? { ok: true, tenant: { slug: tenant.slug, name: tenant.name }, source: "fallback" }
      : { ok: false, reason: "not_found", requestedTenantSlug: tenantSlug };
  } catch (error) {
    logTenantResolution({
      host: hostResolution.host,
      tenantSlug,
      functionName,
      error,
    });
    return { ok: false, reason: "not_found", requestedTenantSlug: tenantSlug };
  }
}
