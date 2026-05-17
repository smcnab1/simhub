import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isAllowedTenantHost,
  normalizeHost,
  normalizeTenantSlug,
  resolveTenantFromHost,
} from "@/lib/tenant-resolver";

describe("tenant host resolver", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("treats the product root as no tenant", () => {
    expect(resolveTenantFromHost("rooms.simhq.app").tenantSlug).toBeNull();
  });

  it("resolves tenant subdomains", () => {
    expect(resolveTenantFromHost("uwl.rooms.simhq.app").tenantSlug).toBe("uwl");
  });

  it("resolves rooms subdomains by slug without requiring a custom domain", () => {
    expect(resolveTenantFromHost("uwl.rooms.simhq.app")).toMatchObject({
      kind: "slug",
      tenantSlug: "uwl",
      customHost: null,
    });
  });

  it("normalizes accidental URL-shaped host values", () => {
    expect(normalizeHost("https://uwl.rooms.simhq.app")).toBe("uwl.rooms.simhq.app");
    expect(resolveTenantFromHost("https://uwl.rooms.simhq.app").tenantSlug).toBe("uwl");
  });

  it("removes ports before resolving tenant subdomains", () => {
    expect(resolveTenantFromHost("demo.rooms.simhq.app:3000").tenantSlug).toBe("demo");
  });

  it("supports localhost tenant query params in development", () => {
    expect(
      resolveTenantFromHost(
        "localhost:3000",
        new URLSearchParams({ tenant: "simhq" })
      ).tenantSlug
    ).toBe("simhq");
  });

  it("supports localhost dashboard tenant query params in development", () => {
    expect(
      resolveTenantFromHost(
        "localhost:3000",
        new URL("http://localhost:3000/dashboard?tenant=simhq").searchParams
      ).tenantSlug
    ).toBe("simhq");
  });

  it("resolves rooms.localhost tenant subdomains", () => {
    expect(resolveTenantFromHost("simhq.rooms.localhost:3000").tenantSlug).toBe("simhq");
  });

  it("supports demo.localhost in development", () => {
    expect(resolveTenantFromHost("demo.localhost:3000").tenantSlug).toBe("demo");
  });

  it("keeps host subdomains ahead of tenant query params", () => {
    expect(
      resolveTenantFromHost(
        "simhq.rooms.simhq.app",
        new URLSearchParams({ tenant: "uwl" })
      ).tenantSlug
    ).toBe("simhq");
  });

  it("supports Vercel preview tenant query params outside production", () => {
    expect(
      resolveTenantFromHost(
        "simhq-git-feature-sammcnab.vercel.app",
        new URLSearchParams({ tenant: "uwl" })
      ).tenantSlug
    ).toBe("uwl");
  });

  it("disables production localhost query fallback unless explicitly enabled", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_TENANT_QUERY_FALLBACK", "");

    expect(
      resolveTenantFromHost(
        "localhost:3000",
        new URLSearchParams({ tenant: "simhq" })
      )
    ).toMatchObject({
      kind: "root",
      tenantSlug: null,
      validHost: false,
    });

    vi.stubEnv("ENABLE_TENANT_QUERY_FALLBACK", "true");

    expect(
      resolveTenantFromHost(
        "localhost:3000",
        new URLSearchParams({ tenant: "simhq" })
      )
    ).toMatchObject({
      kind: "slug",
      tenantSlug: "simhq",
      validHost: true,
    });
  });

  it("disables production rooms.localhost subdomains unless explicitly enabled", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_TENANT_QUERY_FALLBACK", "");

    expect(resolveTenantFromHost("simhq.rooms.localhost:3000")).toMatchObject({
      kind: "root",
      tenantSlug: null,
      validHost: false,
    });

    vi.stubEnv("ENABLE_TENANT_QUERY_FALLBACK", "true");

    expect(resolveTenantFromHost("simhq.rooms.localhost:3000")).toMatchObject({
      kind: "slug",
      tenantSlug: "simhq",
      validHost: true,
    });
  });

  it("normalizes tenant slugs by trimming, lowercasing, and removing invalid chars", () => {
    expect(normalizeTenantSlug(" Sim_HQ! ")).toBe("simhq");
    expect(
      resolveTenantFromHost(
        "localhost:3000",
        new URLSearchParams({ tenant: " Sim_HQ! " })
      ).tenantSlug
    ).toBe("simhq");
  });

  it("rejects reserved tenant slugs", () => {
    expect(resolveTenantFromHost("www.rooms.simhq.app").tenantSlug).toBeNull();
  });

  it("allows only product root, tenant subdomains, and dev localhost", () => {
    expect(isAllowedTenantHost("rooms.simhq.app")).toBe(true);
    expect(isAllowedTenantHost("uwl.rooms.simhq.app")).toBe(true);
    expect(isAllowedTenantHost("localhost:3000")).toBe(true);
    expect(isAllowedTenantHost("simhq.rooms.localhost:3000")).toBe(true);
    expect(isAllowedTenantHost("evil.example.com")).toBe(false);
  });
});
