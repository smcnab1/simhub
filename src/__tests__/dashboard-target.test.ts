import { beforeEach, describe, expect, it, vi } from "vitest";

const targetState = vi.hoisted(() => ({
  memberships: [] as unknown[],
}));

vi.mock("convex/nextjs", () => ({
  fetchQuery: vi.fn(async () => targetState.memberships),
}));

describe("dashboard target resolver", () => {
  beforeEach(() => {
    targetState.memberships = [];
  });

  it("routes a single simhq member on uwl public pages to the simhq dashboard", async () => {
    targetState.memberships = [
      {
        tenantName: "SimHQ",
        tenantSlug: "simhq",
        role: "Staff",
      },
    ];
    const { getDashboardTargetForUser } = await import("@/lib/dashboard-target");

    await expect(
      getDashboardTargetForUser(
        { user: { id: "user_1", email: "user@example.com" } },
        "uwl.rooms.simhq.app"
      )
    ).resolves.toMatchObject({
      kind: "dashboard",
      href: "https://simhq.rooms.simhq.app/dashboard",
    });
  });

  it("routes a single uwl member on uwl public pages to the uwl dashboard", async () => {
    targetState.memberships = [
      {
        tenantName: "UWL",
        tenantSlug: "uwl",
        role: "Staff",
      },
    ];
    const { getDashboardTargetForUser } = await import("@/lib/dashboard-target");

    await expect(
      getDashboardTargetForUser(
        { user: { id: "user_2", email: "uwl@example.com" } },
        "uwl.rooms.simhq.app"
      )
    ).resolves.toMatchObject({
      kind: "dashboard",
      href: "https://uwl.rooms.simhq.app/dashboard",
    });
  });

  it("sends multi-tenant users to the workspace selector", async () => {
    targetState.memberships = [
      { tenantName: "SimHQ", tenantSlug: "simhq", role: "Staff" },
      { tenantName: "UWL", tenantSlug: "uwl", role: "Staff" },
    ];
    const { getDashboardTargetForUser } = await import("@/lib/dashboard-target");

    await expect(
      getDashboardTargetForUser({ user: { id: "user_3" } }, "uwl.rooms.simhq.app")
    ).resolves.toMatchObject({
      kind: "select-workspace",
      href: "/auth/select-workspace",
    });
  });

  it("preserves local tenant query fallback for dashboard targets", async () => {
    targetState.memberships = [
      {
        tenantName: "SimHQ",
        tenantSlug: "simhq",
        role: "Staff",
      },
    ];
    const { getDashboardTargetForUser } = await import("@/lib/dashboard-target");

    await expect(
      getDashboardTargetForUser({ user: { id: "user_4" } }, "localhost:3000")
    ).resolves.toMatchObject({
      kind: "dashboard",
      href: "/dashboard?tenant=simhq",
    });
  });

  it("sends users with no memberships to access pending", async () => {
    const { getDashboardTargetForUser } = await import("@/lib/dashboard-target");

    await expect(
      getDashboardTargetForUser({ user: { id: "user_5" } }, "rooms.simhq.app")
    ).resolves.toMatchObject({
      kind: "access",
      href: "/auth/access",
    });
  });
});
