import { describe, expect, it } from "vitest";
import {
  addDaysToPlainDate,
  localDateString,
  zonedDateTimeToIso,
} from "@/lib/date-time";
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

  it("keeps calendar dates in the tenant timezone", () => {
    expect(localDateString("2026-05-22T23:30:00.000Z", "Europe/London")).toBe(
      "2026-05-23"
    );
    expect(localDateString("2026-05-22T13:00:00.000Z", "Europe/London")).toBe(
      "2026-05-22"
    );
  });

  it("creates booking instants from the tenant timezone rather than browser timezone", () => {
    expect(zonedDateTimeToIso("2026-05-22", "09:00", "Europe/London")).toBe(
      "2026-05-22T08:00:00.000Z"
    );
    expect(zonedDateTimeToIso("2026-12-22", "09:00", "Europe/London")).toBe(
      "2026-12-22T09:00:00.000Z"
    );
  });

  it("moves plain calendar dates without UTC rollover", () => {
    expect(addDaysToPlainDate("2026-05-22", 1)).toBe("2026-05-23");
    expect(addDaysToPlainDate("2026-05-22", -1)).toBe("2026-05-21");
  });
});
