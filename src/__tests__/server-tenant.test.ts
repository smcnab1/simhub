import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  host: "uwl.rooms.simhq.app",
  fetchResult: null as unknown,
  fetchError: null as unknown,
  fetchCalls: 0,
}));

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) => (name === "host" ? state.host : null),
  }),
}));

vi.mock("convex/nextjs", () => ({
  fetchQuery: vi.fn(async () => {
    state.fetchCalls += 1;

    if (state.fetchError) {
      throw state.fetchError;
    }

    return state.fetchResult;
  }),
}));

describe("server tenant resolution", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    state.host = "uwl.rooms.simhq.app";
    state.fetchResult = null;
    state.fetchError = null;
    state.fetchCalls = 0;
  });

  it("resolves an active tenant for public pages without throwing", async () => {
    state.fetchResult = { slug: "uwl", name: "UWL", active: true };
    const { resolveTenantForRequest } = await import("@/lib/server-tenant");

    await expect(resolveTenantForRequest()).resolves.toMatchObject({
      ok: true,
      tenant: { slug: "uwl", name: "UWL" },
      source: "slug",
    });
  });

  it("shows a friendly not-found state for missing tenants", async () => {
    state.fetchResult = null;
    const { resolveTenantForRequest } = await import("@/lib/server-tenant");

    await expect(resolveTenantForRequest()).resolves.toMatchObject({
      ok: false,
      reason: "not_found",
      requestedTenantSlug: "uwl",
    });
  });

  it("shows a friendly not-found state for inactive tenants", async () => {
    state.fetchResult = { slug: "uwl", name: "UWL", active: false };
    const { resolveTenantForRequest } = await import("@/lib/server-tenant");

    await expect(resolveTenantForRequest()).resolves.toMatchObject({
      ok: false,
      reason: "not_found",
      requestedTenantSlug: "uwl",
    });
  });

  it("does not throw when Convex tenant lookup fails", async () => {
    state.fetchError = new Error("Convex unavailable");
    const { resolveTenantForRequest } = await import("@/lib/server-tenant");

    await expect(resolveTenantForRequest()).resolves.toMatchObject({
      ok: false,
      reason: "not_found",
      requestedTenantSlug: "uwl",
    });
  });

  it("still resolves tenant subdomains like uwl.rooms.simhq.app", async () => {
    state.host = "uwl.rooms.simhq.app";
    state.fetchResult = { slug: "uwl", name: "UWL", active: true };
    const { resolveTenantForRequest } = await import("@/lib/server-tenant");

    await expect(resolveTenantForRequest()).resolves.toMatchObject({
      ok: true,
      tenant: { slug: "uwl" },
      source: "slug",
    });
    expect(state.fetchCalls).toBe(1);
  });

  it("does not attempt tenant lookup on rooms.simhq.app root", async () => {
    state.host = "rooms.simhq.app";
    const { resolveTenantForRequest } = await import("@/lib/server-tenant");

    await expect(resolveTenantForRequest()).resolves.toMatchObject({
      ok: false,
      reason: "root",
    });
    expect(state.fetchCalls).toBe(0);
  });

  it("does not fall back to the demo tenant unless demo fallback is enabled", async () => {
    state.host = "rooms.simhq.app";
    vi.stubEnv("ENABLE_DEMO_TENANT_FALLBACK", "");
    const { demoTenantFallbackEnabled } = await import("@/lib/tenant-url");
    const { resolveTenantForRequest } = await import("@/lib/server-tenant");

    await expect(
      resolveTenantForRequest(undefined, {
        fallbackToDefault: demoTenantFallbackEnabled(),
      })
    ).resolves.toMatchObject({
      ok: false,
      reason: "root",
    });
    expect(state.fetchCalls).toBe(0);

    vi.stubEnv("ENABLE_DEMO_TENANT_FALLBACK", "true");
    state.fetchResult = { slug: "university-of-nothing", name: "Demo", active: true };

    await expect(
      resolveTenantForRequest(undefined, {
        fallbackToDefault: demoTenantFallbackEnabled(),
      })
    ).resolves.toMatchObject({
      ok: true,
      source: "fallback",
    });
    expect(state.fetchCalls).toBe(1);
  });
});
