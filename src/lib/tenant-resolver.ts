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
      validHost: boolean;
    }
  | {
      kind: "slug";
      tenantSlug: string;
      customHost: null;
      host: string;
      validHost: boolean;
    }
  | {
      kind: "custom";
      tenantSlug: null;
      customHost: string;
      host: string;
      validHost: boolean;
    };

export function normalizeHost(host: string | null | undefined) {
  const trimmed = (host ?? "").split(",")[0]?.trim().toLowerCase() ?? "";

  if (!trimmed) return "";
  if (trimmed.startsWith("[")) {
    return trimmed.slice(1, trimmed.indexOf("]"));
  }

  return trimmed.split(":")[0] ?? "";
}

function normalizeHostWithPort(host: string | null | undefined) {
  return (host ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
}

export function isValidTenantSlug(slug: string) {
  return SLUG_PATTERN.test(slug) && !RESERVED_TENANT_SLUGS.has(slug);
}

export function isAllowedTenantHost(hostHeader: string | null | undefined) {
  const hostWithPort = normalizeHostWithPort(hostHeader);
  const host = normalizeHost(hostHeader);
  const rootDomain = normalizeHost(PRODUCT_ROOT_DOMAIN);

  if (!host || !rootDomain) {
    return false;
  }

  if (host === rootDomain || host.endsWith(`.${rootDomain}`)) {
    return true;
  }

  if (process.env.NODE_ENV !== "production") {
    return (
      hostWithPort === "localhost:3000" ||
      hostWithPort.endsWith(".localhost:3000")
    );
  }

  return false;
}

export function resolveTenantFromHost(
  hostHeader: string | null | undefined,
  searchParams?: URLSearchParams
): TenantHostResolution {
  const host = normalizeHost(hostHeader);
  const rootDomain = normalizeHost(PRODUCT_ROOT_DOMAIN);
  const validHost = isAllowedTenantHost(hostHeader);

  if (!validHost) {
    return { kind: "root", tenantSlug: null, customHost: null, host, validHost };
  }

  if (!host || host === rootDomain) {
    return { kind: "root", tenantSlug: null, customHost: null, host, validHost };
  }

  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    const tenant = searchParams?.get("tenant")?.trim().toLowerCase() ?? "";
    return isValidTenantSlug(tenant)
      ? { kind: "slug", tenantSlug: tenant, customHost: null, host, validHost }
      : { kind: "root", tenantSlug: null, customHost: null, host, validHost };
  }

  if (host.endsWith(".localhost")) {
    const slug = host.slice(0, -".localhost".length).split(".").at(-1) ?? "";
    return isValidTenantSlug(slug)
      ? { kind: "slug", tenantSlug: slug, customHost: null, host, validHost }
      : { kind: "root", tenantSlug: null, customHost: null, host, validHost };
  }

  const suffix = `.${rootDomain}`;
  if (rootDomain && host.endsWith(suffix)) {
    const subdomain = host.slice(0, -suffix.length);
    return isValidTenantSlug(subdomain) && !subdomain.includes(".")
      ? { kind: "slug", tenantSlug: subdomain, customHost: null, host, validHost }
      : { kind: "root", tenantSlug: null, customHost: null, host, validHost };
  }

  return { kind: "custom", tenantSlug: null, customHost: host, host, validHost };
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
