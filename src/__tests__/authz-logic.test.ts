import { describe, expect, it } from "vitest";
import { canAccessAdmin, canAccessStaff } from "@/lib/authz-logic";

describe("role access helpers", () => {
  it("allows admin access to admin and staff areas", () => {
    expect(canAccessAdmin("Admin")).toBe(true);
    expect(canAccessStaff("Admin")).toBe(true);
  });

  it("allows staff access to staff areas but not admin areas", () => {
    expect(canAccessStaff("Staff")).toBe(true);
    expect(canAccessAdmin("Staff")).toBe(false);
  });

  it("does not allow requester access to staff or admin areas", () => {
    expect(canAccessStaff("Requester")).toBe(false);
    expect(canAccessAdmin("Requester")).toBe(false);
  });
});
