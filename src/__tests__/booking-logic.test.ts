import { describe, expect, it } from "vitest";
import {
  allocateRoomsByType,
  hasBookingConflict,
  rangesOverlap,
  type AssignedBooking,
  type BookingRange,
  type RoomAllocationRoom,
} from "@/lib/booking-logic";

const sessionBlock: BookingRange = {
  start: "2026-05-18T09:00:00+01:00",
  end: "2026-05-18T10:00:00+01:00",
};

describe("booking overlap logic", () => {
  it("returns true for overlapping ranges", () => {
    expect(
      rangesOverlap(sessionBlock, {
        start: "2026-05-18T09:30:00+01:00",
        end: "2026-05-18T11:00:00+01:00",
      })
    ).toBe(true);
  });

  it("returns false for adjacent ranges", () => {
    expect(
      rangesOverlap(sessionBlock, {
        start: "2026-05-18T10:00:00+01:00",
        end: "2026-05-18T11:00:00+01:00",
      })
    ).toBe(false);
  });

  it("returns false for non-overlapping ranges", () => {
    expect(
      rangesOverlap(sessionBlock, {
        start: "2026-05-18T11:00:00+01:00",
        end: "2026-05-18T12:00:00+01:00",
      })
    ).toBe(false);
  });

  it("checks conflicts across multiple booking blocks", () => {
    const existingBookings: AssignedBooking[] = [
      {
        assignedRoomIds: ["room-1"],
        blocks: [
          { start: "2026-05-18T07:00:00+01:00", end: "2026-05-18T08:00:00+01:00" },
          { start: "2026-05-18T12:00:00+01:00", end: "2026-05-18T13:00:00+01:00" },
        ],
      },
    ];

    expect(
      hasBookingConflict(
        [
          { start: "2026-05-18T08:00:00+01:00", end: "2026-05-18T09:00:00+01:00" },
          { start: "2026-05-18T12:30:00+01:00", end: "2026-05-18T14:00:00+01:00" },
        ],
        existingBookings
      )
    ).toBe(true);
  });
});

describe("room allocation logic", () => {
  const rooms: RoomAllocationRoom[] = [
    { id: "classroom-1", roomTypeId: "classroom", active: true },
    { id: "classroom-2", roomTypeId: "classroom", active: true },
    { id: "classroom-3", roomTypeId: "classroom", active: false },
    { id: "ward-1", roomTypeId: "ward", active: true },
  ];

  it("allocates available active rooms by room type and quantity", () => {
    expect(
      allocateRoomsByType(rooms, [], [sessionBlock], [
        { roomTypeId: "classroom", quantity: 2 },
        { roomTypeId: "ward", quantity: 1 },
      ])
    ).toEqual({
      success: true,
      assignedRoomIds: ["classroom-1", "classroom-2", "ward-1"],
    });
  });

  it("excludes inactive rooms", () => {
    expect(
      allocateRoomsByType(rooms, [], [sessionBlock], [{ roomTypeId: "classroom", quantity: 3 }])
    ).toMatchObject({
      success: false,
      assignedRoomIds: [],
    });
  });

  it("excludes rooms already assigned to overlapping approved bookings", () => {
    const approvedBookings: AssignedBooking[] = [
      {
        assignedRoomIds: ["classroom-1"],
        blocks: [{ start: "2026-05-18T09:30:00+01:00", end: "2026-05-18T10:30:00+01:00" }],
      },
      {
        assignedRoomIds: ["ward-1"],
        blocks: [{ start: "2026-05-18T10:00:00+01:00", end: "2026-05-18T11:00:00+01:00" }],
      },
    ];

    expect(
      allocateRoomsByType(rooms, approvedBookings, [sessionBlock], [{ roomTypeId: "classroom", quantity: 1 }])
    ).toEqual({
      success: true,
      assignedRoomIds: ["classroom-2"],
    });
  });

  it("returns an insufficient result if not enough rooms are available", () => {
    const result = allocateRoomsByType(
      rooms,
      [
        {
          assignedRoomIds: ["classroom-1"],
          blocks: [{ start: "2026-05-18T09:15:00+01:00", end: "2026-05-18T09:45:00+01:00" }],
        },
      ],
      [sessionBlock],
      [{ roomTypeId: "classroom", quantity: 2 }]
    );

    expect(result).toMatchObject({
      success: false,
      assignedRoomIds: [],
    });
  });
});
