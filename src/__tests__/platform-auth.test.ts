import { beforeEach, describe, expect, it, vi } from "vitest";

const platformState = vi.hoisted(() => ({
  session: { user: null } as {
    user: { id?: string; email?: string; metadata?: Record<string, unknown> } | null;
    role?: unknown;
    roles?: unknown;
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

describe("platform developer auth", () => {
  beforeEach(() => {
    platformState.session = { user: null };
    platformState.redirectTo = "";
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
});
