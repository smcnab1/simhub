import { beforeEach, describe, expect, it, vi } from "vitest";

const platformState = vi.hoisted(() => ({
  session: { user: null } as {
    user: { id?: string; email?: string; metadata?: Record<string, unknown> } | null;
    role?: unknown;
    roles?: unknown;
  } | null,
  refreshedUser: null as {
    id?: string;
    email?: string;
    metadata?: Record<string, unknown>;
  } | null,
  redirectTo: "",
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();

  return {
    ...actual,
    getCurrentUser: vi.fn(async () => platformState.session),
  };
});

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    platformState.redirectTo = url;
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("@workos-inc/node", () => ({
  WorkOS: vi.fn(function WorkOS() {
    return {
      userManagement: {
        getUser: vi.fn(async () => platformState.refreshedUser),
      },
    };
  }),
}));

describe("platform developer auth", () => {
  beforeEach(() => {
    platformState.session = { user: null };
    platformState.refreshedUser = null;
    platformState.redirectTo = "";
    vi.unstubAllEnvs();
  });

  it("allows root-domain /dev access for a Developer without a tenantSlug", async () => {
    platformState.session = {
      user: { id: "dev_123", email: "dev@example.com" },
      role: "Developer",
    };
    const { getPlatformAccess } = await import("@/lib/platform-auth");

    await expect(getPlatformAccess()).resolves.toMatchObject({
      ok: true,
      auth: {
        platformRole: "Developer",
        workosUserId: "dev_123",
        email: "dev@example.com",
      },
    });
  });

  it("forbids root-domain /dev access for non-Developer users", async () => {
    platformState.session = {
      user: { id: "staff_123", email: "staff@example.com" },
      role: "Staff",
    };
    const { getPlatformAccess } = await import("@/lib/platform-auth");

    await expect(getPlatformAccess()).resolves.toMatchObject({
      ok: false,
      reason: "insufficient_role",
      role: "Staff",
    });
  });

  it("refreshes WorkOS metadata when the signed session is stale", async () => {
    vi.stubEnv("WORKOS_API_KEY", "sk_test_123");
    platformState.session = {
      user: { id: "dev_123", email: "dev@example.com", metadata: {} },
      role: "Staff",
    };
    platformState.refreshedUser = {
      id: "dev_123",
      email: "dev@example.com",
      metadata: { role: "Developer" },
    };
    const { getPlatformAccess } = await import("@/lib/platform-auth");

    await expect(getPlatformAccess()).resolves.toMatchObject({
      ok: true,
      auth: {
        platformRole: "Developer",
        workosUserId: "dev_123",
      },
    });
  });
});
