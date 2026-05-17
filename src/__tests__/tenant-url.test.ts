import { afterEach, describe, expect, it, vi } from "vitest";
import { tenantAwareHref } from "@/lib/tenant-url";

describe("tenant-aware URLs", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps tenant query fallback on local dashboard links", () => {
    expect(
      tenantAwareHref("/calendar", {
        host: "localhost:3000",
        tenantFromQuery: "uwl",
      })
    ).toBe("/calendar?tenant=uwl");

    expect(
      tenantAwareHref("/calendar", {
        host: "localhost:3000",
        tenantFromQuery: "simhq",
      })
    ).toBe("/calendar?tenant=simhq");
  });

  it("preserves existing query params when appending tenant", () => {
    expect(
      tenantAwareHref("/calendar?month=2026-05", {
        host: "localhost:3000",
        tenantFromQuery: "uwl",
      })
    ).toBe("/calendar?month=2026-05&tenant=uwl");
  });

  it("does not append query fallback on tenant subdomains", () => {
    expect(
      tenantAwareHref("/calendar", {
        host: "uwl.rooms.simhq.app",
        tenantFromQuery: "simhq",
      })
    ).toBe("/calendar");
  });

  it("uses selected membership tenant for local links without query tenant", () => {
    expect(
      tenantAwareHref("/calendar", {
        host: "localhost:3000",
        selectedTenantSlug: "uwl",
      })
    ).toBe("/calendar?tenant=uwl");
  });

  it("does not silently add demo on production root without explicit tenant context", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_TENANT_QUERY_FALLBACK", "");
    vi.stubEnv("ENABLE_DEMO_TENANT_FALLBACK", "");

    expect(
      tenantAwareHref("/calendar", {
        host: "rooms.simhq.app",
      })
    ).toBe("/calendar");
  });
});
