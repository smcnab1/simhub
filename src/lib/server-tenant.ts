import { fetchQuery } from "convex/nextjs";
import { api } from "../../convex/_generated/api";
import {
  fallbackTenantSlug,
  getTenantHostResolution,
  tenantRootDomains,
} from "@/lib/tenant-resolver";

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
  rawHost?: string;
  host: string;
  tenantSlug?: string | null;
  lookupMode?: "slug" | "custom" | "fallback" | "root";
  found?: boolean;
  active?: boolean | null;
  functionName?: string;
  error?: unknown;
}) {
  const logPayload = {
    rawHost: event.rawHost ?? event.host,
    host: event.host,
    normalizedHost: event.host,
    tenantSlug: event.tenantSlug ?? null,
    lookupMode: event.lookupMode,
    found: event.found,
    active: event.active,
    convexFunction: event.functionName,
    domainEnv: {
      SIMHQ_ROOMS_ROOT_DOMAIN: process.env.SIMHQ_ROOMS_ROOT_DOMAIN ?? null,
      NEXT_PUBLIC_SIMHQ_ROOMS_ROOT_DOMAIN:
        process.env.NEXT_PUBLIC_SIMHQ_ROOMS_ROOT_DOMAIN ?? null,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? null,
      VERCEL_PROJECT_PRODUCTION_URL:
        process.env.VERCEL_PROJECT_PRODUCTION_URL ?? null,
      VERCEL_URL: process.env.VERCEL_URL ?? null,
      tenantRootDomains: tenantRootDomains(),
    },
  };

  if (event.error || event.found === false || event.active === false) {
    console.warn("[tenant-resolution] Tenant lookup did not resolve active tenant", logPayload);
  } else {
    console.info("[tenant-resolution]", logPayload);
  }

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
        rawHost: hostResolution.rawHost,
        host: hostResolution.host,
        tenantSlug: hostResolution.tenantSlug,
        lookupMode: "slug",
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
        rawHost: hostResolution.rawHost,
        host: hostResolution.host,
        tenantSlug: hostResolution.tenantSlug,
        lookupMode: "slug",
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
        rawHost: hostResolution.rawHost,
        host: hostResolution.host,
        tenantSlug: tenant?.slug,
        lookupMode: "custom",
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
        rawHost: hostResolution.rawHost,
        host: hostResolution.host,
        lookupMode: "custom",
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
    if (!tenantRootDomains().includes(hostResolution.host)) {
      logTenantResolution({
        rawHost: hostResolution.rawHost,
        host: hostResolution.host,
        tenantSlug: null,
        lookupMode: "root",
        found: false,
        active: null,
      });
    }

    return { ok: false, reason: "root" };
  }

  const tenantSlug = fallbackTenantSlug(searchParams?.get("tenant"));
  const functionName = "tenants.getPublicTenantBySlug" as const;

  try {
    const tenant = await fetchPublicTenant(functionName, { slug: tenantSlug });

    logTenantResolution({
      rawHost: hostResolution.rawHost,
      host: hostResolution.host,
      tenantSlug,
      lookupMode: "fallback",
      found: !!tenant,
      active: tenant?.active ?? null,
      functionName,
    });

    return tenant?.active
      ? { ok: true, tenant: { slug: tenant.slug, name: tenant.name }, source: "fallback" }
      : { ok: false, reason: "not_found", requestedTenantSlug: tenantSlug };
  } catch (error) {
    logTenantResolution({
      rawHost: hostResolution.rawHost,
      host: hostResolution.host,
      tenantSlug,
      lookupMode: "fallback",
      functionName,
      error,
    });
    return { ok: false, reason: "not_found", requestedTenantSlug: tenantSlug };
  }
}
