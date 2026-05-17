const PRODUCT_ROOT_DOMAIN = "rooms.simhq.app";
const INVALID_SLUG_CHARS = /[^a-z0-9-]/g;

export type TenantUrlContext = {
  host?: string | null;
  tenantFromQuery?: string | null;
  selectedTenantSlug?: string | null;
  productRootDomain?: string;
  queryFallbackEnabled?: boolean;
};

function normalizeHost(host: string | null | undefined) {
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

function normalizeTenantSlug(slug: string | null | undefined) {
  return (slug ?? "").trim().toLowerCase().replace(INVALID_SLUG_CHARS, "");
}

function isLocalOrPreviewHost(host: string, productRootDomain: string) {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".localhost") ||
    host === "vercel.app" ||
    host.endsWith(".vercel.app") ||
    host === productRootDomain
  );
}

function hasTenantSubdomain(host: string, productRootDomain: string) {
  const suffix = `.${productRootDomain}`;

  if (!host.endsWith(suffix)) {
    return host.endsWith(".rooms.localhost") && host !== "rooms.localhost";
  }

  const subdomain = host.slice(0, -suffix.length);
  return Boolean(subdomain) && !subdomain.includes(".");
}

function fallbackEnabled() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_TENANT_QUERY_FALLBACK === "true"
  );
}

export function tenantAwareHref(path: string, context: TenantUrlContext = {}) {
  const productRootDomain = normalizeHost(context.productRootDomain ?? PRODUCT_ROOT_DOMAIN);
  const host = normalizeHost(context.host);
  const url = new URL(path, "https://simhq.local");

  if (host && hasTenantSubdomain(host, productRootDomain)) {
    return `${url.pathname}${url.search}${url.hash}`;
  }

  const queryFallbackAllowed = context.queryFallbackEnabled ?? fallbackEnabled();
  if (!queryFallbackAllowed || !isLocalOrPreviewHost(host, productRootDomain)) {
    return `${url.pathname}${url.search}${url.hash}`;
  }

  const tenant =
    normalizeTenantSlug(context.tenantFromQuery) ||
    normalizeTenantSlug(context.selectedTenantSlug);

  if (tenant) {
    url.searchParams.set("tenant", tenant);
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

export function demoTenantFallbackEnabled() {
  return process.env.ENABLE_DEMO_TENANT_FALLBACK === "true";
}
