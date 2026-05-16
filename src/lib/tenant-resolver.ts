import { headers } from "next/headers";
import { TENANT_SLUG } from "@/lib/config";

export const PRODUCT_ROOT_DOMAIN =
  process.env.SIMHQ_ROOMS_ROOT_DOMAIN ?? "rooms.simhq.app";

export const RESERVED_TENANT_SLUGS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "dashboard",
  "login",
  "auth",
  "rooms",
]);

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export type TenantHostResolution =
  | {
      kind: "root";
      tenantSlug: null;
      customHost: null;
      host: string;
    }
  | {
      kind: "slug";
      tenantSlug: string;
      customHost: null;
      host: string;
    }
  | {
      kind: "custom";
      tenantSlug: null;
      customHost: string;
      host: string;
    };

export function normalizeHost(host: string | null | undefined) {
  const trimmed = (host ?? "").split(",")[0]?.trim().toLowerCase() ?? "";

  if (!trimmed) return "";
  if (trimmed.startsWith("[")) {
    return trimmed.slice(1, trimmed.indexOf("]"));
  }

  return trimmed.split(":")[0] ?? "";
}

export function isValidTenantSlug(slug: string) {
  return SLUG_PATTERN.test(slug) && !RESERVED_TENANT_SLUGS.has(slug);
}

export function resolveTenantFromHost(
  hostHeader: string | null | undefined,
  searchParams?: URLSearchParams
): TenantHostResolution {
  const host = normalizeHost(hostHeader);
  const rootDomain = normalizeHost(PRODUCT_ROOT_DOMAIN);

  if (!host || host === rootDomain) {
    return { kind: "root", tenantSlug: null, customHost: null, host };
  }

  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    const tenant = searchParams?.get("tenant")?.trim().toLowerCase() ?? "";
    return isValidTenantSlug(tenant)
      ? { kind: "slug", tenantSlug: tenant, customHost: null, host }
      : { kind: "root", tenantSlug: null, customHost: null, host };
  }

  if (host.endsWith(".localhost")) {
    const slug = host.slice(0, -".localhost".length).split(".").at(-1) ?? "";
    return isValidTenantSlug(slug)
      ? { kind: "slug", tenantSlug: slug, customHost: null, host }
      : { kind: "root", tenantSlug: null, customHost: null, host };
  }

  const suffix = `.${rootDomain}`;
  if (rootDomain && host.endsWith(suffix)) {
    const subdomain = host.slice(0, -suffix.length);
    return isValidTenantSlug(subdomain) && !subdomain.includes(".")
      ? { kind: "slug", tenantSlug: subdomain, customHost: null, host }
      : { kind: "root", tenantSlug: null, customHost: null, host };
  }

  return { kind: "custom", tenantSlug: null, customHost: host, host };
}

export async function getTenantHostResolution(searchParams?: URLSearchParams) {
  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ??
    headerStore.get("host") ??
    "";

  return resolveTenantFromHost(host, searchParams);
}

export function fallbackTenantSlug(slug: string | null | undefined) {
  return slug && isValidTenantSlug(slug) ? slug : TENANT_SLUG;
}
