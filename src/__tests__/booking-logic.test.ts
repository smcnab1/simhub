import { describe, expect, it } from "vitest";
import {
  allocateRoomsByType,
  bookingDurationMinutes,
  bookingBlocksFromSessionWindow,
  checkAvailabilityConflicts,
  evaluateBookingNoticeWindow,
  formatBookingDuration,
  hasBookingConflict,
  occupancyDurationMinutes,
  occupiedBookingWindow,
  rangesOverlap,
  roomTypeBufferMinutes,
  validateBookingBlocks,
  validateBookingWithinStaffHours,
  validateMaxBookingDuration,
  validateSessionWithinOpeningHours,
  validateRoomSelectionState,
  sessionDurationMinutes,
  type AssignedBooking,
  type BookingBlock,
  type BookingRange,
  type RoomAllocationRoom,
} from "@/lib/booking-logic";
import {
  campusIsActive,
  normalizeCampusName,
  normalizeCampusText,
  sortCampuses,
  validateCampusSortOrder,
} from "@/lib/campus";

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

describe("booking duration rules", () => {
  it("formats booking durations in hours and minutes", () => {
    expect(formatBookingDuration(45)).toBe("45 min");
    expect(formatBookingDuration(60)).toBe("1 hr");
    expect(formatBookingDuration(150)).toBe("2 hrs 30 min");
  });

  it("calculates total booking span in minutes", () => {
    expect(
      bookingDurationMinutes([
        { start: "2026-05-18T09:00:00+01:00", end: "2026-05-18T09:30:00+01:00" },
        { start: "2026-05-18T09:30:00+01:00", end: "2026-05-18T11:00:00+01:00" },
      ])
    ).toBe(120);
  });

  it("returns a validation message when a selected room type exceeds its duration rule", () => {
    expect(
      validateMaxBookingDuration(
        [{ start: "2026-05-18T09:00:00+01:00", end: "2026-05-18T11:30:00+01:00" }],
        [{ roomTypeId: "ward", quantity: 1 }],
        [{ id: "ward", name: "Ward", maxBookingDurationMinutes: 120 }]
      )
    ).toBe("Ward bookings cannot exceed 2 hrs.");
  });

  it("allows bookings within the selected room type duration rule", () => {
    expect(
      validateMaxBookingDuration(
        [{ start: "2026-05-18T09:00:00+01:00", end: "2026-05-18T10:30:00+01:00" }],
        [{ roomTypeId: "ward", quantity: 1 }],
        [{ id: "ward", name: "Ward", maxBookingDurationMinutes: 120 }]
      )
    ).toBeNull();
  });
});

describe("booking block validation", () => {
  it("validates setup, session, and cleanup chronology", () => {
    expect(
      validateBookingBlocks([
        { label: "Setup", start: "2026-05-18T09:00:00+01:00", end: "2026-05-18T09:30:00+01:00" },
        { label: "Session", start: "2026-05-18T09:30:00+01:00", end: "2026-05-18T10:30:00+01:00" },
        { label: "Cleanup", start: "2026-05-18T10:30:00+01:00", end: "2026-05-18T11:00:00+01:00" },
      ])
    ).toBeNull();
  });

  it("builds setup and cleanup blocks from room type buffers", () => {
    expect(
      bookingBlocksFromSessionWindow(
        "2026-05-18T09:30:00+01:00",
        "2026-05-18T10:30:00+01:00",
        { setupMinutes: 45, cleanupMinutes: 20 }
      )
    ).toEqual([
      {
        label: "Setup",
        start: "2026-05-18T07:45:00.000Z",
        end: "2026-05-18T09:30:00+01:00",
      },
      {
        label: "Session",
        start: "2026-05-18T09:30:00+01:00",
        end: "2026-05-18T10:30:00+01:00",
      },
      {
        label: "Cleanup",
        start: "2026-05-18T10:30:00+01:00",
        end: "2026-05-18T09:50:00.000Z",
      },
    ]);
  });

  it("uses the largest setup and cleanup buffer across selected room types", () => {
    expect(
      roomTypeBufferMinutes(
        [
          { roomTypeId: "classroom", quantity: 1 },
          { roomTypeId: "immersive", quantity: 1 },
        ],
        [
          { id: "classroom", name: "Classroom", standardSetupMinutes: 30, standardCleanupMinutes: 15 },
          { id: "immersive", name: "Immersive", standardSetupMinutes: 60, standardCleanupMinutes: 45 },
        ]
      )
    ).toEqual({ setupMinutes: 60, cleanupMinutes: 45 });
  });

  it("validates session times against opening hours", () => {
    expect(
      validateSessionWithinOpeningHours(
        { start: "2026-05-18T09:30:00+01:00", end: "2026-05-18T10:30:00+01:00" },
        "Monday: 09:00 - 17:00",
        "Europe/London"
      )
    ).toBeNull();

    expect(
      validateSessionWithinOpeningHours(
        { start: "2026-05-18T08:30:00+01:00", end: "2026-05-18T10:30:00+01:00" },
        "Monday: 09:00 - 17:00",
        "Europe/London"
      )
    ).toBe("Session time must be within Monday opening hours.");
  });

  it("allows setup and cleanup inside staff hours around public hours", () => {
    const hours = "Monday: Public 09:00 - 17:00; Staff 08:30 - 17:30";

    expect(
      validateSessionWithinOpeningHours(
        { start: "2026-05-18T09:00:00+01:00", end: "2026-05-18T17:00:00+01:00" },
        hours,
        "Europe/London"
      )
    ).toBeNull();

    expect(
      validateBookingWithinStaffHours(
        { start: "2026-05-18T08:30:00+01:00", end: "2026-05-18T17:30:00+01:00" },
        hours,
        "Europe/London"
      )
    ).toBeNull();
  });

  it("excludes setup and cleanup from max duration rules", () => {
    const blocks: BookingBlock[] = [
      { label: "Setup", start: "2026-05-18T08:30:00+01:00", end: "2026-05-18T09:00:00+01:00" },
      { label: "Session", start: "2026-05-18T09:00:00+01:00", end: "2026-05-18T17:00:00+01:00" },
      { label: "Cleanup", start: "2026-05-18T17:00:00+01:00", end: "2026-05-18T17:30:00+01:00" },
    ];

    expect(
      validateMaxBookingDuration(
        blocks,
        [{ roomTypeId: "classroom", quantity: 1 }],
        [{ id: "classroom", name: "Classroom", maxBookingDurationMinutes: 480 }]
      )
    ).toBeNull();
  });

  it("reports separate occupancy and session durations", () => {
    const blocks: BookingBlock[] = [
      { label: "Setup", start: "2026-05-18T08:00:00+01:00", end: "2026-05-18T09:00:00+01:00" },
      { label: "Session", start: "2026-05-18T09:00:00+01:00", end: "2026-05-18T17:00:00+01:00" },
      { label: "Cleanup", start: "2026-05-18T17:00:00+01:00", end: "2026-05-18T18:00:00+01:00" },
    ];

    expect(sessionDurationMinutes(blocks)).toBe(480);
    expect(occupancyDurationMinutes(blocks)).toBe(600);
  });

  it("rejects cleanup before the session ends", () => {
    expect(
      validateBookingBlocks([
        { label: "Setup", start: "2026-05-18T09:00:00+01:00", end: "2026-05-18T09:30:00+01:00" },
        { label: "Session", start: "2026-05-18T09:30:00+01:00", end: "2026-05-18T10:30:00+01:00" },
        { label: "Cleanup", start: "2026-05-18T10:00:00+01:00", end: "2026-05-18T11:00:00+01:00" },
      ])
    ).toBe("Cleanup cannot start before the session ends.");
  });

  it("calculates the occupied window from setup start through cleanup end", () => {
    expect(
      occupiedBookingWindow([
        { start: "2026-05-18T09:00:00+01:00", end: "2026-05-18T09:15:00+01:00" },
        { start: "2026-05-18T10:00:00+01:00", end: "2026-05-18T11:00:00+01:00" },
        { start: "2026-05-18T11:30:00+01:00", end: "2026-05-18T12:00:00+01:00" },
      ])
    ).toEqual([
      {
        start: "2026-05-18T08:00:00.000Z",
        end: "2026-05-18T11:00:00.000Z",
      },
    ]);
  });
});

describe("booking notice windows", () => {
  it("blocks public bookings inside the minimum notice window", () => {
    const result = evaluateBookingNoticeWindow({
      sessionStart: "2026-05-19T09:00:00+01:00",
      now: new Date("2026-05-16T08:00:00+01:00"),
      timezone: "Europe/London",
      rules: {
        minimumAdvanceBookingDays: 5,
        violationMode: "Block",
      },
    });

    expect(result.canSubmit).toBe(false);
    expect(result.violations[0]?.message).toBe("Bookings require at least 5 days notice.");
  });

  it("allows warning-mode notice violations as additional approval", () => {
    const result = evaluateBookingNoticeWindow({
      sessionStart: "2026-09-01T09:00:00+01:00",
      now: new Date("2026-05-16T08:00:00+01:00"),
      timezone: "Europe/London",
      rules: {
        maximumAdvanceBookingDays: 90,
        violationMode: "Warn",
      },
    });

    expect(result.canSubmit).toBe(true);
    expect(result.requiresAdditionalApproval).toBe(true);
    expect(result.violations[0]?.message).toBe("Bookings cannot be made more than 90 days in advance.");
  });

  it("requires staff acknowledgement before overriding block-mode notice violations", () => {
    const unacknowledged = evaluateBookingNoticeWindow({
      sessionStart: "2026-05-19T09:00:00+01:00",
      now: new Date("2026-05-16T08:00:00+01:00"),
      timezone: "Europe/London",
      canOverride: true,
      rules: {
        minimumAdvanceBookingDays: 5,
        violationMode: "Block",
      },
    });
    const acknowledged = evaluateBookingNoticeWindow({
      sessionStart: "2026-05-19T09:00:00+01:00",
      now: new Date("2026-05-16T08:00:00+01:00"),
      timezone: "Europe/London",
      canOverride: true,
      overrideAcknowledged: true,
      rules: {
        minimumAdvanceBookingDays: 5,
        violationMode: "Block",
      },
    });

    expect(unacknowledged.canSubmit).toBe(false);
    expect(unacknowledged.overrideRequired).toBe(true);
    expect(acknowledged.canSubmit).toBe(true);
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

describe("availability conflict engine", () => {
  const rooms = [
    {
      id: "immersive-1",
      code: "PH901",
      name: "Immersive Suite 1",
      roomTypeId: "immersive",
      campusId: "campus-1",
      active: true,
    },
    {
      id: "immersive-2",
      code: "PH902",
      name: "Immersive Suite 2",
      roomTypeId: "immersive",
      campusId: "campus-1",
      active: true,
    },
  ];
  const roomTypes = [
    {
      id: "immersive",
      name: "Immersive Room",
      campusId: "campus-1",
      active: true,
    },
  ];
  const campuses = [{ id: "campus-1", name: "Paragon House", active: true }];

  it("reports exact room overlaps as likely unavailable", () => {
    const result = checkAvailabilityConflicts({
      blocks: [sessionBlock],
      roomTypeRequests: [{ roomTypeId: "immersive", quantity: 1 }],
      requestedRoomIds: ["immersive-1"],
      rooms,
      roomTypes,
      campuses,
      bookings: [
        {
          id: "booking-1",
          status: "Approved",
          assignedRoomIds: ["immersive-1"],
          blocks: [{ start: "2026-05-18T09:30:00+01:00", end: "2026-05-18T10:30:00+01:00" }],
        },
      ],
    });

    expect(result.available).toBe(false);
    expect(result.conflicts).toContainEqual(
      expect.objectContaining({
        type: "exact_room_overlap",
        severity: "likely_unavailable",
        roomCode: "PH901",
      })
    );
  });

  it("reports room type exhaustion against approved bookings", () => {
    const result = checkAvailabilityConflicts({
      blocks: [sessionBlock],
      roomTypeRequests: [{ roomTypeId: "immersive", quantity: 1 }],
      rooms,
      roomTypes,
      campuses,
      bookings: [
        {
          id: "booking-1",
          status: "Approved",
          assignedRoomIds: ["immersive-1"],
          blocks: [sessionBlock],
        },
        {
          id: "booking-2",
          status: "Approved",
          assignedRoomIds: ["immersive-2"],
          blocks: [sessionBlock],
        },
      ],
    });

    expect(result.conflicts).toContainEqual(
      expect.objectContaining({
        type: "room_type_exhausted",
        severity: "likely_unavailable",
        roomTypeName: "Immersive Room",
      })
    );
  });

  it("treats pending room type exhaustion as a warning", () => {
    const result = checkAvailabilityConflicts({
      blocks: [sessionBlock],
      roomTypeRequests: [{ roomTypeId: "immersive", quantity: 2 }],
      rooms,
      roomTypes,
      campuses,
      bookings: [
        {
          id: "pending-1",
          status: "Pending",
          assignedRoomIds: [],
          roomTypeRequests: [{ roomTypeId: "immersive", quantity: 1 }],
          blocks: [sessionBlock],
        },
      ],
    });

    expect(result.available).toBe(true);
    expect(result.conflicts).toContainEqual(
      expect.objectContaining({
        type: "room_type_exhausted",
        severity: "warning",
      })
    );
  });

  it("reports blocked campus periods", () => {
    const result = checkAvailabilityConflicts({
      blocks: [sessionBlock],
      roomTypeRequests: [{ roomTypeId: "immersive", quantity: 1 }],
      rooms,
      roomTypes,
      campuses,
      bookings: [],
      blockedTimes: [
        {
          id: "block-1",
          campusId: "campus-1",
          start: "2026-05-18T08:30:00+01:00",
          end: "2026-05-18T11:00:00+01:00",
          reason: "Maintenance",
        },
      ],
    });

    expect(result.conflicts).toContainEqual(
      expect.objectContaining({
        type: "campus_unavailable",
        severity: "likely_unavailable",
        campusName: "Paragon House",
        blockedReason: "Maintenance",
      })
    );
  });
});

describe("room selection state validation", () => {
  it("allows specific rooms without room type quantities", () => {
    expect(
      validateRoomSelectionState({
        roomSelectionMode: "SpecificRooms",
        requestedRoomIds: ["room-1", "room-2"],
        roomTypeRequests: [],
      })
    ).toBeNull();
  });

  it("rejects mixed specific room and room type quantity selections", () => {
    expect(
      validateRoomSelectionState({
        roomSelectionMode: "SpecificRooms",
        requestedRoomIds: ["room-1"],
        roomTypeRequests: [{ roomTypeId: "classroom", quantity: 1 }],
      })
    ).toBe("Specific room requests cannot also include room type quantities.");
  });

  it("allows room type quantity selections without specific rooms", () => {
    expect(
      validateRoomSelectionState({
        roomSelectionMode: "RoomTypeQuantity",
        requestedRoomIds: [],
        roomTypeRequests: [{ roomTypeId: "classroom", quantity: 2 }],
      })
    ).toBeNull();
  });

  it("rejects duplicate specific rooms", () => {
    expect(
      validateRoomSelectionState({
        roomSelectionMode: "SpecificRooms",
        requestedRoomIds: ["room-1", "room-1"],
      })
    ).toBe("The same room cannot be requested more than once.");
  });
});

describe("campus lifecycle and ordering helpers", () => {
  it("treats legacy campuses without active as active", () => {
    expect(campusIsActive({})).toBe(true);
    expect(campusIsActive({ active: true })).toBe(true);
    expect(campusIsActive({ active: false })).toBe(false);
  });

  it("sorts campuses by manual sort order, then name", () => {
    expect(
      sortCampuses([
        { name: "Reading", sortOrder: 20 },
        { name: "Brentford", sortOrder: 10 },
        { name: "Acton" },
        { name: "Ealing" },
      ]).map((campus) => campus.name)
    ).toEqual(["Brentford", "Reading", "Acton", "Ealing"]);
  });

  it("normalizes campus names and validates sort order", () => {
    expect(normalizeCampusName("  City   Campus  ")).toBe("City Campus");
    expect(normalizeCampusText("  Paragon   House  ")).toBe("Paragon House");
    expect(normalizeCampusText("   ")).toBeUndefined();
    expect(validateCampusSortOrder(0)).toBeNull();
    expect(validateCampusSortOrder(1.5)).toBe(
      "Sort order must be a whole number greater than or equal to zero."
    );
  });
});
