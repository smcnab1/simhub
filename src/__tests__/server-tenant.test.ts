import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  host: "uwl.rooms.simhq.app",
  fetchResult: null as unknown,
  fetchError: null as unknown,
}));

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) => (name === "host" ? state.host : null),
  }),
}));

vi.mock("convex/nextjs", () => ({
  fetchQuery: vi.fn(async () => {
    if (state.fetchError) {
      throw state.fetchError;
    }

    return state.fetchResult;
  }),
}));

describe("server tenant resolution", () => {
  beforeEach(() => {
    state.host = "uwl.rooms.simhq.app";
    state.fetchResult = null;
    state.fetchError = null;
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
});
