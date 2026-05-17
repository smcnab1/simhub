import { beforeEach, describe, expect, it, vi } from "vitest";

const dashboardState = vi.hoisted(() => ({
  redirectTo: "",
  session: { user: null } as {
    user: {
      id?: string;
      email?: string;
      firstName?: string | null;
      lastName?: string | null;
      name?: string | null;
    } | null;
    organizationId?: string;
  } | null,
  memberships: [] as unknown[],
  hostTenantSlug: null as string | null,
  cookies: {} as Record<string, string>,
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();

  return {
    ...actual,
    getCurrentUser: vi.fn(async () => dashboardState.session),
  };
});

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    dashboardState.redirectTo = url;
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = dashboardState.cookies[name];
      return value ? { name, value } : undefined;
    },
  }),
}));

vi.mock("convex/nextjs", () => ({
  fetchQuery: vi.fn(async () => dashboardState.memberships),
}));

vi.mock("@/lib/tenant-resolver", () => ({
  getTenantHostResolution: vi.fn(async () =>
    dashboardState.hostTenantSlug
      ? {
          kind: "slug",
          tenantSlug: dashboardState.hostTenantSlug,
          customHost: null,
          host: `${dashboardState.hostTenantSlug}.rooms.simhq.app`,
          rawHost: `${dashboardState.hostTenantSlug}.rooms.simhq.app`,
          validHost: true,
        }
      : {
          kind: "root",
          tenantSlug: null,
          customHost: null,
          host: "rooms.simhq.app",
          rawHost: "rooms.simhq.app",
          validHost: true,
        }
  ),
}));

describe("dashboard access", () => {
  beforeEach(() => {
    dashboardState.redirectTo = "";
    dashboardState.session = { user: null };
    dashboardState.memberships = [];
    dashboardState.hostTenantSlug = null;
    dashboardState.cookies = {};
  });

  it("redirects unauthenticated dashboard users to WorkOS sign-in", async () => {
    const { getDashboardAccess } = await import("@/lib/dashboard-access");

    await expect(getDashboardAccess()).rejects.toThrow("NEXT_REDIRECT");
    expect(dashboardState.redirectTo).toBe("/auth/sign-in");
  });

  it("allows a user with tenantSlug simhq to access simhq.rooms.simhq.app/dashboard", async () => {
    dashboardState.session = {
      user: {
        id: "workos-user-1",
        email: "user@example.com",
        firstName: "Sam",
        lastName: "McNab",
      },
      organizationId: "org_simhq",
    };
    dashboardState.hostTenantSlug = "simhq";
    dashboardState.memberships = [
      {
        tenantName: "SimHQ",
        tenantSlug: "simhq",
        role: "Staff",
        tenantId: "tenant_simhq",
        workosOrganizationId: "org_simhq",
      },
    ];
    const { getDashboardAccess } = await import("@/lib/dashboard-access");

    await expect(getDashboardAccess()).resolves.toMatchObject({
      ok: true,
      auth: {
        tenantSlug: "simhq",
        tenantName: "SimHQ",
        user: {
          firstName: "Sam",
          lastName: "McNab",
        },
        role: "Staff",
      },
    });
  });

  it("normalises a returned slug field when tenantSlug is absent", async () => {
    dashboardState.session = {
      user: { id: "workos-user-1", email: "user@example.com" },
      organizationId: "org_simhq",
    };
    dashboardState.hostTenantSlug = "simhq";
    dashboardState.memberships = [
      {
        tenantName: "SimHQ",
        slug: "simhq",
        role: "Admin",
        tenantId: "tenant_simhq",
        workosOrganizationId: "org_simhq",
      },
    ];
    const { getDashboardAccess } = await import("@/lib/dashboard-access");

    await expect(getDashboardAccess({ requiredRole: "admin" })).resolves.toMatchObject({
      ok: true,
      auth: {
        tenantSlug: "simhq",
        role: "Admin",
      },
    });
  });

  it("matches simhq membership across case variants", async () => {
    dashboardState.session = {
      user: { id: "workos-user-1", email: "user@example.com" },
      organizationId: "org_simhq",
    };
    dashboardState.hostTenantSlug = "simhq";
    dashboardState.memberships = [
      {
        tenantName: "SimHQ",
        tenantSlug: "SimHQ",
        role: "staff",
        tenantId: "tenant_simhq",
        workosOrganizationId: "org_simhq",
      },
    ];
    const { getDashboardAccess } = await import("@/lib/dashboard-access");

    await expect(getDashboardAccess({ requiredRole: "staff" })).resolves.toMatchObject({
      ok: true,
      auth: {
        tenantSlug: "simhq",
        role: "Staff",
      },
    });
  });
});
