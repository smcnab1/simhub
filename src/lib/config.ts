export const APP_NAME = "SimHQ";
export const APP_SLUG = "simhq";
export const TENANT_COOKIE_NAME = "simhq-tenant-slug";
export const LEGACY_TENANT_COOKIE_NAME = "simhub-tenant-slug";

export const TENANT_SLUG =
  process.env.NEXT_PUBLIC_SIMHQ_TENANT_SLUG ??
  process.env.NEXT_PUBLIC_SIMHUB_TENANT_SLUG ??
  "demo";
