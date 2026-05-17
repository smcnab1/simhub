import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authState = vi.hoisted(() => ({
  signInOptions: null as unknown,
  redirectUrl: "",
}));

vi.mock("@workos-inc/authkit-nextjs", () => ({
  getSignInUrl: vi.fn(async (options) => {
    authState.signInOptions = options;
    return "https://authkit.example.test/sign-in";
  }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [],
    delete: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    authState.redirectUrl = url;
    throw new Error("NEXT_REDIRECT");
  }),
}));

describe("sign-in route", () => {
  it("passes the uwl host callback URL to WorkOS", async () => {
    const { GET } = await import("@/app/auth/sign-in/route");
    const req = new NextRequest(
      "https://uwl.rooms.simhq.app/auth/sign-in?returnTo=/dashboard",
      {
        headers: {
          host: "uwl.rooms.simhq.app",
          "x-forwarded-proto": "https",
        },
      }
    );

    await expect(GET(req)).rejects.toThrow("NEXT_REDIRECT");
    expect(authState.signInOptions).toMatchObject({
      returnTo: "/dashboard",
      redirectUri: "https://uwl.rooms.simhq.app/auth/callback",
    });
    expect(authState.redirectUrl).toBe("https://authkit.example.test/sign-in");
  });
});
