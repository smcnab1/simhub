import { describe, expect, it, vi } from "vitest";

const dashboardState = vi.hoisted(() => ({
  redirectTo: "",
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => ({ user: null })),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    dashboardState.redirectTo = url;
    throw new Error("NEXT_REDIRECT");
  }),
}));

describe("dashboard access", () => {
  it("redirects unauthenticated dashboard users to WorkOS sign-in", async () => {
    const { getDashboardAccess } = await import("@/lib/dashboard-access");

    await expect(getDashboardAccess()).rejects.toThrow("NEXT_REDIRECT");
    expect(dashboardState.redirectTo).toBe("/auth/sign-in");
  });
});
