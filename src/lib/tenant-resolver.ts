import { headers } from "next/headers";
import { TENANT_SLUG } from "@/lib/config";

export const DEFAULT_PRODUCT_ROOT_DOMAIN = "rooms.simhq.app";
export const LOCAL_PRODUCT_ROOT_DOMAIN = "rooms.localhost";
export const PRODUCT_ROOT_DOMAIN =
  process.env.SIMHQ_ROOMS_ROOT_DOMAIN ?? DEFAULT_PRODUCT_ROOT_DOMAIN;

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
const INVALID_SLUG_CHARS = /[^a-z0-9-]/g;

export type TenantHostResolution =
  | {
      kind: "root";
      tenantSlug: null;
      customHost: null;
      host: string;
      rawHost: string;
      validHost: boolean;
    }
  | {
      kind: "slug";
      tenantSlug: string;
      customHost: null;
      host: string;
      rawHost: string;
      validHost: boolean;
    }
  | {
      kind: "custom";
      tenantSlug: null;
      customHost: string;
      host: string;
      rawHost: string;
      validHost: boolean;
    };

export function normalizeHost(host: string | null | undefined) {
  const trimmed = (host ?? "").split(",")[0]?.trim().toLowerCase() ?? "";

  if (!trimmed) return "";
  if (trimmed.includes("://")) {
    try {
      return normalizeHost(new URL(trimmed).host);
    } catch {
      return "";
    }
  }

  if (trimmed.startsWith("[")) {
    return trimmed.slice(1, trimmed.indexOf("]"));
  }

  return trimmed.split(":")[0] ?? "";
}

export function isValidTenantSlug(slug: string) {
  return SLUG_PATTERN.test(slug) && !RESERVED_TENANT_SLUGS.has(slug);
}

export function normalizeTenantSlug(slug: string | null | undefined) {
  return (slug ?? "").trim().toLowerCase().replace(INVALID_SLUG_CHARS, "");
}

function queryFallbackEnabled() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_TENANT_QUERY_FALLBACK === "true"
  );
}

function isLocalhost(host: string) {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function isVercelPreviewHost(host: string) {
  return host === "vercel.app" || host.endsWith(".vercel.app");
}

function tenantSlugFromQuery(searchParams?: URLSearchParams) {
  if (!queryFallbackEnabled()) {
    return null;
  }

  const tenant = normalizeTenantSlug(searchParams?.get("tenant"));
  return isValidTenantSlug(tenant) ? tenant : null;
}

export function tenantRootDomains() {
  return [
    DEFAULT_PRODUCT_ROOT_DOMAIN,
    queryFallbackEnabled() ? LOCAL_PRODUCT_ROOT_DOMAIN : null,
    PRODUCT_ROOT_DOMAIN,
    process.env.NEXT_PUBLIC_SIMHQ_ROOMS_ROOT_DOMAIN,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]
    .map(normalizeHost)
    .filter((domain): domain is string => Boolean(domain));
}

function tenantRootDomainForHost(host: string) {
  return tenantRootDomains()
    .filter((domain) => host === domain || host.endsWith(`.${domain}`))
    .sort((a, b) => b.length - a.length)[0] ?? null;
}

export function isAllowedTenantHost(hostHeader: string | null | undefined) {
  const host = normalizeHost(hostHeader);

  if (!host) {
    return false;
  }

  if (tenantRootDomainForHost(host)) {
    return true;
  }

  if (process.env.NODE_ENV !== "production") {
    return (
      isLocalhost(host) ||
      host.endsWith(".localhost") ||
      isVercelPreviewHost(host)
    );
  }

  return queryFallbackEnabled() && (isLocalhost(host) || isVercelPreviewHost(host));
}

export function resolveTenantFromHost(
  hostHeader: string | null | undefined,
  searchParams?: URLSearchParams
): TenantHostResolution {
  const rawHost = (hostHeader ?? "").split(",")[0]?.trim() ?? "";
  const host = normalizeHost(hostHeader);
  const rootDomain = tenantRootDomainForHost(host);
  const validHost = isAllowedTenantHost(hostHeader);

  if (!validHost) {
    return { kind: "root", tenantSlug: null, customHost: null, host, rawHost, validHost };
  }

  if (isLocalhost(host) || isVercelPreviewHost(host)) {
    const tenant = tenantSlugFromQuery(searchParams);
    return tenant
      ? { kind: "slug", tenantSlug: tenant, customHost: null, host, rawHost, validHost }
      : { kind: "root", tenantSlug: null, customHost: null, host, rawHost, validHost };
  }

  if (!host || host === rootDomain) {
    const tenant = tenantSlugFromQuery(searchParams);
    return tenant
      ? { kind: "slug", tenantSlug: tenant, customHost: null, host, rawHost, validHost }
      : { kind: "root", tenantSlug: null, customHost: null, host, rawHost, validHost };
  }

  if (host.endsWith(".localhost") && !host.endsWith(`.${LOCAL_PRODUCT_ROOT_DOMAIN}`)) {
    const slug = normalizeTenantSlug(host.slice(0, -".localhost".length).split(".").at(-1));
    return isValidTenantSlug(slug)
      ? { kind: "slug", tenantSlug: slug, customHost: null, host, rawHost, validHost }
      : { kind: "root", tenantSlug: null, customHost: null, host, rawHost, validHost };
  }

  const suffix = `.${rootDomain}`;
  if (rootDomain && host.endsWith(suffix)) {
    const subdomain = normalizeTenantSlug(host.slice(0, -suffix.length));
    return isValidTenantSlug(subdomain) && !subdomain.includes(".")
      ? { kind: "slug", tenantSlug: subdomain, customHost: null, host, rawHost, validHost }
      : { kind: "root", tenantSlug: null, customHost: null, host, rawHost, validHost };
  }

  return { kind: "custom", tenantSlug: null, customHost: host, host, rawHost, validHost };
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
  const tenantSlug = normalizeTenantSlug(slug);
  return tenantSlug && isValidTenantSlug(tenantSlug) ? tenantSlug : TENANT_SLUG;
}
