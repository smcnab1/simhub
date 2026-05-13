import { describe, expect, it } from "vitest";
import { blockHours, overlaps, withinUploadLimit } from "@/lib/time";

describe("time helpers", () => {
  it("calculates setup, session, and cleanup duration", () => {
    expect(blockHours([
      { label: "Setup", start: "2026-05-18T08:00:00+01:00", end: "2026-05-18T09:00:00+01:00" },
      { label: "Session", start: "2026-05-18T09:00:00+01:00", end: "2026-05-18T12:30:00+01:00" },
      { label: "Cleanup", start: "2026-05-18T12:30:00+01:00", end: "2026-05-18T13:00:00+01:00" },
    ])).toBe(5);
  });

  it("enforces upload limits", () => {
    expect(withinUploadLimit(1024)).toBe(true);
    expect(withinUploadLimit(101, 100)).toBe(false);
  });

  it("detects overlapping blocks", () => {
    expect(overlaps("2026-05-18T09:00:00+01:00", "2026-05-18T10:00:00+01:00", "2026-05-18T09:30:00+01:00", "2026-05-18T11:00:00+01:00")).toBe(true);
    expect(overlaps("2026-05-18T09:00:00+01:00", "2026-05-18T10:00:00+01:00", "2026-05-18T10:00:00+01:00", "2026-05-18T11:00:00+01:00")).toBe(false);
  });
});
