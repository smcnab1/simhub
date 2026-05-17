import { describe, expect, it } from "vitest";
import { getDashboardNavigation } from "@/lib/navigation";

describe("dashboard navigation", () => {
  it("shows Developer section only to platform Developer users", () => {
    expect(
      getDashboardNavigation({ role: "Developer" }).some(
        (group) => group.title === "Developer"
      )
    ).toBe(false);

    expect(
      getDashboardNavigation({ role: "Staff", platformRole: "Developer" }).some(
        (group) => group.title === "Developer"
      )
    ).toBe(true);
  });
});
