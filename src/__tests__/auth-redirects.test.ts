import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  getAuthCallbackUrl,
  getSafeAuthReturnUrl,
  getSafeReturnPath,
  shouldResolveDashboardTarget,
} from "@/lib/auth-redirects";

function request(url: string, headers?: Record<string, string>) {
  return new NextRequest(url, { headers });
}

describe("tenant auth redirects", () => {
  it("uses the tenant subdomain callback for uwl sign-in", () => {
    const req = request("https://uwl.rooms.simhq.app/auth/sign-in?returnTo=/dashboard", {
      host: "uwl.rooms.simhq.app",
      "x-forwarded-proto": "https",
    });

    expect(getSafeReturnPath(req)).toBe("/dashboard");
    expect(getAuthCallbackUrl(req)).toBe("https://uwl.rooms.simhq.app/auth/callback");
  });

  it("marks dashboard callbacks for membership-based resolution", () => {
    const req = request("https://uwl.rooms.simhq.app/auth/callback", {
      host: "uwl.rooms.simhq.app",
      "x-forwarded-proto": "https",
    });

    expect(getSafeAuthReturnUrl("/dashboard", req).toString()).toBe(
      "https://uwl.rooms.simhq.app/dashboard"
    );
    expect(shouldResolveDashboardTarget("/dashboard")).toBe(true);
  });

  it("does not resolve public return paths as dashboards", () => {
    expect(shouldResolveDashboardTarget("/")).toBe(false);
    expect(shouldResolveDashboardTarget("/calendar?tenant=uwl")).toBe(false);
    expect(shouldResolveDashboardTarget("/book")).toBe(false);
  });

  it("does not allow absolute cross-host return paths", () => {
    const req = request(
      "https://uwl.rooms.simhq.app/auth/sign-in?returnTo=https%3A%2F%2Frooms.simhq.app%2Fdashboard",
      { host: "uwl.rooms.simhq.app" }
    );

    expect(getSafeReturnPath(req)).toBe("/dashboard");
  });

  it("does not build callbacks on untrusted hosts", () => {
    const req = request("https://evil.example.com/auth/sign-in", {
      host: "evil.example.com",
      "x-forwarded-proto": "https",
    });

    expect(getAuthCallbackUrl(req)).toBe("http://localhost:3000/auth/callback");
  });
});
