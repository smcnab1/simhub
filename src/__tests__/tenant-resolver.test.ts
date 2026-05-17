import { describe, expect, it } from "vitest";
import { isAllowedTenantHost, resolveTenantFromHost } from "@/lib/tenant-resolver";

describe("tenant host resolver", () => {
  it("treats the product root as no tenant", () => {
    expect(resolveTenantFromHost("rooms.simhq.app").tenantSlug).toBeNull();
  });

  it("resolves tenant subdomains", () => {
    expect(resolveTenantFromHost("uwl.rooms.simhq.app").tenantSlug).toBe("uwl");
  });

  it("removes ports before resolving tenant subdomains", () => {
    expect(resolveTenantFromHost("demo.rooms.simhq.app:3000").tenantSlug).toBe("demo");
  });

  it("supports localhost tenant query params", () => {
    expect(
      resolveTenantFromHost(
        "localhost:3000",
        new URLSearchParams({ tenant: "demo" })
      ).tenantSlug
    ).toBe("demo");
  });

  it("supports demo.localhost in development", () => {
    expect(resolveTenantFromHost("demo.localhost:3000").tenantSlug).toBe("demo");
  });

  it("rejects reserved tenant slugs", () => {
    expect(resolveTenantFromHost("www.rooms.simhq.app").tenantSlug).toBeNull();
  });

  it("allows only product root, tenant subdomains, and dev localhost", () => {
    expect(isAllowedTenantHost("rooms.simhq.app")).toBe(true);
    expect(isAllowedTenantHost("uwl.rooms.simhq.app")).toBe(true);
    expect(isAllowedTenantHost("localhost:3000")).toBe(true);
    expect(isAllowedTenantHost("evil.example.com")).toBe(false);
  });
});
