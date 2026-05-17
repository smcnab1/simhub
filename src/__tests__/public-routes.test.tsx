import { describe, expect, it, vi } from "vitest";

const routeState = vi.hoisted(() => ({
  resolveTenantForRequest: vi.fn(async () => ({
    ok: true,
    tenant: {
      slug: "uwl",
      name: "University of West London",
    },
    source: "slug",
  })),
  getCurrentUser: vi.fn(() => {
    throw new Error("Public route unexpectedly requested auth");
  }),
}));

vi.mock("@/lib/server-tenant", () => ({
  resolveTenantForRequest: routeState.resolveTenantForRequest,
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: routeState.getCurrentUser,
}));

describe("tenant public routes", () => {
  it("allows an unauthenticated user to load the uwl tenant landing page", async () => {
    const { default: HomePage } = await import("@/app/page");

    await expect(
      HomePage({ searchParams: Promise.resolve({}) })
    ).resolves.toBeTruthy();
    expect(routeState.getCurrentUser).not.toHaveBeenCalled();
  });

  it("allows an unauthenticated user to load the uwl booking page", async () => {
    const { default: BookPage } = await import("@/app/(public)/book/page");

    await expect(
      BookPage({ searchParams: Promise.resolve({}) })
    ).resolves.toBeTruthy();
    expect(routeState.getCurrentUser).not.toHaveBeenCalled();
  });

  it("allows an unauthenticated user to load the uwl public calendar", async () => {
    const { default: CalendarPage } = await import("@/app/(public)/calendar/page");

    await expect(
      CalendarPage({ searchParams: Promise.resolve({}) })
    ).resolves.toBeTruthy();
    expect(routeState.getCurrentUser).not.toHaveBeenCalled();
  });
});
