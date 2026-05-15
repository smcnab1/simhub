export type BookingRange = {
  start: string;
  end: string;
};

export type BookingBlockLabel = "Setup" | "Session" | "Cleanup";

export type BookingBlock = BookingRange & {
  label: BookingBlockLabel;
};

export type RoomAllocationRoom = {
  id: string;
  roomTypeId: string;
  active: boolean;
};

export type RoomTypeRequest = {
  roomTypeId: string;
  quantity: number;
};

export type RoomSelectionMode = "SpecificRooms" | "RoomTypeQuantity";

export type BookingRoomSelection =
  | {
      roomSelectionMode: "SpecificRooms";
      requestedRoomIds: string[];
      roomTypeRequests?: RoomTypeRequest[];
    }
  | {
      roomSelectionMode: "RoomTypeQuantity";
      requestedRoomIds?: string[];
      roomTypeRequests: RoomTypeRequest[];
    };

export type RoomTypeBookingRule = {
  id: string;
  name: string;
  maxBookingDurationMinutes?: number;
};

export type AssignedBooking = {
  blocks: BookingRange[];
  assignedRoomIds: string[];
};

export type AvailabilityConflictSeverity =
  | "informational"
  | "warning"
  | "likely_unavailable";

export type AvailabilityConflictType =
  | "invalid_time"
  | "duration_rule"
  | "exact_room_overlap"
  | "pending_overlap"
  | "room_type_exhausted"
  | "blocked_period"
  | "campus_unavailable";

export type AvailabilityConflict = {
  type: AvailabilityConflictType;
  severity: AvailabilityConflictSeverity;
  message: string;
  roomId?: string;
  roomCode?: string;
  roomName?: string;
  roomTypeId?: string;
  roomTypeName?: string;
  campusId?: string;
  campusName?: string;
  conflictingRequestId?: string;
  conflictingStatus?: "Pending" | "Approved" | "Completed";
  blockedTimeId?: string;
  blockedReason?: string;
  overlapStart?: string;
  overlapEnd?: string;
};

export type AvailabilityCheckResult = {
  available: boolean;
  canSubmit: boolean;
  highestSeverity?: AvailabilityConflictSeverity;
  summary: string;
  conflicts: AvailabilityConflict[];
};

export type AvailabilityRoom = {
  id: string;
  code: string;
  name: string;
  roomTypeId: string;
  campusId?: string;
  active: boolean;
};

export type AvailabilityRoomType = RoomTypeBookingRule & {
  campusId?: string;
  active: boolean;
};

export type AvailabilityCampus = {
  id: string;
  name: string;
  active: boolean;
};

export type AvailabilityBooking = {
  id: string;
  status: "Pending" | "Approved" | "Completed" | "Declined" | "Cancelled";
  blocks: BookingRange[];
  assignedRoomIds: string[];
  requestedRoomIds?: string[];
  roomTypeRequests?: RoomTypeRequest[];
};

export type AvailabilityBlockedTime = BookingRange & {
  id: string;
  reason: string;
  roomId?: string;
  roomTypeId?: string;
  campusId?: string;
};

export type AvailabilityCheckInput = {
  roomSelectionMode?: RoomSelectionMode;
  blocks: BookingRange[];
  roomTypeRequests: RoomTypeRequest[];
  requestedRoomIds?: string[];
  rooms: AvailabilityRoom[];
  roomTypes: AvailabilityRoomType[];
  campuses?: AvailabilityCampus[];
  bookings: AvailabilityBooking[];
  blockedTimes?: AvailabilityBlockedTime[];
};

export function occupiedBookingWindow(blocks: BookingRange[]): BookingRange[] {
  const starts = blocks.map((block) => Date.parse(block.start));
  const ends = blocks.map((block) => Date.parse(block.end));
  const earliestStart = Math.min(...starts);
  const latestEnd = Math.max(...ends);

  if (!Number.isFinite(earliestStart) || !Number.isFinite(latestEnd)) {
    return blocks;
  }

  return [
    {
      start: new Date(earliestStart).toISOString(),
      end: new Date(latestEnd).toISOString(),
    },
  ];
}

export function validateBookingBlocks(blocks: BookingBlock[]) {
  const setup = blocks.find((block) => block.label === "Setup");
  const session = blocks.find((block) => block.label === "Session");
  const cleanup = blocks.find((block) => block.label === "Cleanup");

  if (!setup || !session || !cleanup) {
    return "Setup, session, and cleanup times are required.";
  }

  const ordered = [setup, session, cleanup];

  for (const block of ordered) {
    const start = Date.parse(block.start);
    const end = Date.parse(block.end);

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return "Booking times must be valid dates and times.";
    }

    if (start >= end) {
      return `${block.label} start must be before ${block.label.toLowerCase()} end.`;
    }
  }

  if (Date.parse(setup.end) > Date.parse(session.start)) {
    return "Setup must end before the session starts.";
  }

  if (Date.parse(session.end) > Date.parse(cleanup.start)) {
    return "Cleanup cannot start before the session ends.";
  }

  return null;
}

export function validateRoomSelectionState(selection: BookingRoomSelection) {
  const requestedRoomIds = selection.requestedRoomIds ?? [];
  const roomTypeRequests = selection.roomTypeRequests ?? [];

  if (selection.roomSelectionMode === "SpecificRooms") {
    if (requestedRoomIds.length === 0) {
      return "Select at least one room.";
    }

    if (new Set(requestedRoomIds).size !== requestedRoomIds.length) {
      return "The same room cannot be requested more than once.";
    }

    if (roomTypeRequests.some((request) => request.quantity > 0)) {
      return "Specific room requests cannot also include room type quantities.";
    }

    return null;
  }

  if (requestedRoomIds.length > 0) {
    return "Room type quantity requests cannot also include specific rooms.";
  }

  const selectedRoomTypeRequests = roomTypeRequests.filter(
    (request) => request.quantity > 0
  );

  if (selectedRoomTypeRequests.length === 0) {
    return "Select at least one room type.";
  }

  if (selectedRoomTypeRequests.length !== roomTypeRequests.length) {
    return "Room quantities must be whole numbers greater than zero.";
  }

  if (
    selectedRoomTypeRequests.some(
      (request) => !Number.isInteger(request.quantity) || request.quantity <= 0
    )
  ) {
    return "Room quantities must be whole numbers greater than zero.";
  }

  if (
    new Set(selectedRoomTypeRequests.map((request) => request.roomTypeId)).size !==
    selectedRoomTypeRequests.length
  ) {
    return "The same room type cannot be requested more than once.";
  }

  return null;
}

export type RoomAllocationResult =
  | {
      success: true;
      assignedRoomIds: string[];
    }
  | {
      success: false;
      assignedRoomIds: string[];
      reason: string;
    };

export function rangesOverlap(a: BookingRange, b: BookingRange) {
  return Date.parse(a.start) < Date.parse(b.end) && Date.parse(b.start) < Date.parse(a.end);
}

function validRange(range: BookingRange) {
  const start = Date.parse(range.start);
  const end = Date.parse(range.end);
  return Number.isFinite(start) && Number.isFinite(end) && start < end;
}

function overlapBounds(a: BookingRange, b: BookingRange) {
  if (!rangesOverlap(a, b)) return null;

  const startMs = Math.max(Date.parse(a.start), Date.parse(b.start));
  const endMs = Math.min(Date.parse(a.end), Date.parse(b.end));

  return {
    overlapStart: new Date(startMs).toISOString(),
    overlapEnd: new Date(endMs).toISOString(),
  };
}

export function hasAnyBlockOverlap(candidateBlocks: BookingRange[], existingBlocks: BookingRange[]) {
  return existingBlocks.some((existing) => candidateBlocks.some((candidate) => rangesOverlap(candidate, existing)));
}

export function hasBookingConflict(candidateBlocks: BookingRange[], existingBookings: AssignedBooking[]) {
  return existingBookings.some((booking) => hasAnyBlockOverlap(candidateBlocks, booking.blocks));
}

export function bookingDurationMinutes(blocks: BookingRange[]) {
  const starts = blocks.map((block) => Date.parse(block.start));
  const ends = blocks.map((block) => Date.parse(block.end));
  const earliestStart = Math.min(...starts);
  const latestEnd = Math.max(...ends);

  if (!Number.isFinite(earliestStart) || !Number.isFinite(latestEnd) || latestEnd <= earliestStart) {
    return null;
  }

  return Math.ceil((latestEnd - earliestStart) / 60000);
}

export function formatBookingDuration(minutes: number) {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const hourLabel = `${hours} hr${hours === 1 ? "" : "s"}`;

  if (remainingMinutes === 0) {
    return hourLabel;
  }

  return `${hourLabel} ${remainingMinutes} min`;
}

export function validateMaxBookingDuration(
  blocks: BookingRange[],
  roomTypeRequests: RoomTypeRequest[],
  roomTypes: RoomTypeBookingRule[]
) {
  const durationMinutes = bookingDurationMinutes(blocks);

  if (durationMinutes === null) {
    return "Booking start and end times are invalid.";
  }

  const requestedTypeIds = new Set(
    roomTypeRequests
      .filter((request) => request.quantity > 0)
      .map((request) => request.roomTypeId)
  );

  const breachedRule = roomTypes.find(
    (roomType) =>
      requestedTypeIds.has(roomType.id) &&
      roomType.maxBookingDurationMinutes !== undefined &&
      durationMinutes > roomType.maxBookingDurationMinutes
  );

  if (!breachedRule) {
    return null;
  }

  const maxBookingDurationMinutes = breachedRule.maxBookingDurationMinutes;

  if (maxBookingDurationMinutes === undefined) {
    return null;
  }

  return `${breachedRule.name} bookings cannot exceed ${formatBookingDuration(maxBookingDurationMinutes)}.`;
}

export function allocateRoomsByType(
  rooms: RoomAllocationRoom[],
  approvedBookings: AssignedBooking[],
  candidateBlocks: BookingRange[],
  roomTypeRequests: RoomTypeRequest[]
): RoomAllocationResult {
  const occupiedRoomIds = new Set(
    approvedBookings
      .filter((booking) => hasAnyBlockOverlap(candidateBlocks, booking.blocks))
      .flatMap((booking) => booking.assignedRoomIds)
  );
  const assignedRoomIds: string[] = [];
  const selectedRoomIds = new Set<string>();

  for (const request of roomTypeRequests) {
    if (request.quantity <= 0) continue;

    const availableRooms = rooms.filter(
      (room) =>
        room.active &&
        room.roomTypeId === request.roomTypeId &&
        !occupiedRoomIds.has(room.id) &&
        !selectedRoomIds.has(room.id)
    );

    if (availableRooms.length < request.quantity) {
      return {
        success: false,
        assignedRoomIds,
        reason: `Insufficient available rooms for room type ${request.roomTypeId}.`,
      };
    }

    const selectedRooms = availableRooms.slice(0, request.quantity);
    selectedRooms.forEach((room) => {
      selectedRoomIds.add(room.id);
      assignedRoomIds.push(room.id);
    });
  }

  return { success: true, assignedRoomIds };
}

function severityRank(severity: AvailabilityConflictSeverity) {
  return severity === "likely_unavailable" ? 3 : severity === "warning" ? 2 : 1;
}

function highestConflictSeverity(conflicts: AvailabilityConflict[]) {
  return conflicts.reduce<AvailabilityConflictSeverity | undefined>(
    (highest, conflict) =>
      !highest || severityRank(conflict.severity) > severityRank(highest)
        ? conflict.severity
        : highest,
    undefined
  );
}

function roomLabel(room: AvailabilityRoom) {
  return `${room.code} (${room.name})`;
}

function roomIsBlockedBy(blockedTime: AvailabilityBlockedTime, room: AvailabilityRoom) {
  if (blockedTime.roomId) {
    return blockedTime.roomId === room.id;
  }

  if (blockedTime.roomTypeId) {
    return blockedTime.roomTypeId === room.roomTypeId;
  }

  if (blockedTime.campusId) {
    return blockedTime.campusId === room.campusId;
  }

  return true;
}

function bookingConsumesRoom(
  booking: AvailabilityBooking,
  room: AvailabilityRoom
) {
  return [
    ...booking.assignedRoomIds,
    ...(booking.requestedRoomIds ?? []),
  ].includes(room.id);
}

function overlappingBlockedTimes(
  blocks: BookingRange[],
  blockedTimes: AvailabilityBlockedTime[]
) {
  return blockedTimes.flatMap((blockedTime) =>
    blocks
      .map((block) => overlapBounds(block, blockedTime))
      .filter((overlap): overlap is { overlapStart: string; overlapEnd: string } => overlap !== null)
      .map((overlap) => ({ blockedTime, overlap }))
  );
}

function roomUnavailableForApproved(
  room: AvailabilityRoom,
  blocks: BookingRange[],
  approvedBookings: AvailabilityBooking[],
  blockedTimes: AvailabilityBlockedTime[]
) {
  return (
    approvedBookings.some(
      (booking) =>
        bookingConsumesRoom(booking, room) &&
        hasAnyBlockOverlap(blocks, booking.blocks)
    ) ||
    blockedTimes.some(
      (blockedTime) =>
        roomIsBlockedBy(blockedTime, room) &&
        hasAnyBlockOverlap(blocks, [blockedTime])
    )
  );
}

function pendingConsumesType(
  booking: AvailabilityBooking,
  roomTypeId: string
) {
  const assignedCount = booking.assignedRoomIds.length;

  if (assignedCount > 0) {
    return 0;
  }

  return (booking.roomTypeRequests ?? [])
    .filter((request) => request.roomTypeId === roomTypeId)
    .reduce((total, request) => total + request.quantity, 0);
}

export function checkAvailabilityConflicts(
  input: AvailabilityCheckInput
): AvailabilityCheckResult {
  const conflicts: AvailabilityConflict[] = [];
  const roomById = new Map(input.rooms.map((room) => [room.id, room]));
  const roomTypeById = new Map(input.roomTypes.map((roomType) => [roomType.id, roomType]));
  const campusById = new Map((input.campuses ?? []).map((campus) => [campus.id, campus]));
  const blockedTimes = input.blockedTimes ?? [];
  const candidateBlocks = occupiedBookingWindow(input.blocks);
  const roomSelectionMode = input.roomSelectionMode ?? "RoomTypeQuantity";

  for (const block of candidateBlocks) {
    if (!validRange(block)) {
      conflicts.push({
        type: "invalid_time",
        severity: "likely_unavailable",
        message: "Booking start and end times are invalid.",
      });
    }
  }

  const durationError = validateMaxBookingDuration(
    candidateBlocks,
    input.roomTypeRequests,
    input.roomTypes
  );

  if (durationError) {
    conflicts.push({
      type: "duration_rule",
      severity: "likely_unavailable",
      message: durationError,
    });
  }

  const approvedBookings = input.bookings.filter(
    (booking) => booking.status === "Approved" || booking.status === "Completed"
  );
  const pendingBookings = input.bookings.filter(
    (booking) => booking.status === "Pending"
  );

  for (const roomId of input.requestedRoomIds ?? []) {
    const room = roomById.get(roomId);
    if (!room) continue;

    for (const booking of approvedBookings) {
      if (!bookingConsumesRoom(booking, room)) continue;

      for (const block of candidateBlocks) {
        for (const existingBlock of booking.blocks) {
          const overlap = overlapBounds(block, existingBlock);
          if (!overlap) continue;

          conflicts.push({
            type: "exact_room_overlap",
            severity: "likely_unavailable",
            message: `${room.code} is already booked during this time.`,
            roomId: room.id,
            roomCode: room.code,
            roomName: room.name,
            roomTypeId: room.roomTypeId,
            conflictingRequestId: booking.id,
            conflictingStatus: booking.status === "Completed" ? "Completed" : "Approved",
            ...overlap,
          });
        }
      }
    }

    for (const booking of pendingBookings) {
      if (!bookingConsumesRoom(booking, room)) continue;

      for (const block of candidateBlocks) {
        for (const existingBlock of booking.blocks) {
          const overlap = overlapBounds(block, existingBlock);
          if (!overlap) continue;

          conflicts.push({
            type: "pending_overlap",
            severity: "warning",
            message: `${room.code} is requested by another pending booking during this time.`,
            roomId: room.id,
            roomCode: room.code,
            roomName: room.name,
            roomTypeId: room.roomTypeId,
            conflictingRequestId: booking.id,
            conflictingStatus: "Pending",
            ...overlap,
          });
        }
      }
    }
  }

  for (const { blockedTime, overlap } of overlappingBlockedTimes(
    candidateBlocks,
    blockedTimes
  )) {
    const room = blockedTime.roomId ? roomById.get(blockedTime.roomId) : undefined;
    const roomType = blockedTime.roomTypeId
      ? roomTypeById.get(blockedTime.roomTypeId)
      : undefined;
    const campus = blockedTime.campusId
      ? campusById.get(blockedTime.campusId)
      : undefined;
    const relevantToSpecificRoom =
      !input.requestedRoomIds?.length ||
      input.requestedRoomIds.some((roomId) => {
        const requestedRoom = roomById.get(roomId);
        return requestedRoom ? roomIsBlockedBy(blockedTime, requestedRoom) : false;
      });
    const relevantToRoomType =
      input.roomTypeRequests.length === 0 ||
      input.roomTypeRequests.some((request) => {
        const requestedRoomType = roomTypeById.get(request.roomTypeId);
        return (
          blockedTime.roomTypeId === request.roomTypeId ||
          blockedTime.campusId === requestedRoomType?.campusId ||
          (!blockedTime.roomId && !blockedTime.roomTypeId && !blockedTime.campusId)
        );
      });

    if (!relevantToSpecificRoom && !relevantToRoomType) continue;

    conflicts.push({
      type: blockedTime.campusId && !blockedTime.roomId && !blockedTime.roomTypeId
        ? "campus_unavailable"
        : "blocked_period",
      severity: "likely_unavailable",
      message: campus
        ? `This time overlaps with a blocked period for ${campus.name}.`
        : room
          ? `${roomLabel(room)} is blocked during this time.`
          : roomType
            ? `All rooms of type '${roomType.name}' are blocked during this time.`
            : "This time overlaps with a blocked period.",
      roomId: room?.id,
      roomCode: room?.code,
      roomName: room?.name,
      roomTypeId: roomType?.id,
      roomTypeName: roomType?.name,
      campusId: campus?.id,
      campusName: campus?.name,
      blockedTimeId: blockedTime.id,
      blockedReason: blockedTime.reason,
      ...overlap,
    });
  }

  if (roomSelectionMode === "RoomTypeQuantity") for (const request of input.roomTypeRequests) {
    if (request.quantity <= 0) continue;

    const roomType = roomTypeById.get(request.roomTypeId);
    const activeRoomsForType = input.rooms.filter(
      (room) => room.active && room.roomTypeId === request.roomTypeId
    );
    const availableAfterApproved = activeRoomsForType.filter(
      (room) =>
        !roomUnavailableForApproved(
          room,
          candidateBlocks,
          approvedBookings,
          blockedTimes
        )
    );

    if (availableAfterApproved.length < request.quantity) {
      conflicts.push({
        type: "room_type_exhausted",
        severity: "likely_unavailable",
        message: `All rooms of type '${roomType?.name ?? request.roomTypeId}' are currently allocated.`,
        roomTypeId: request.roomTypeId,
        roomTypeName: roomType?.name,
      });
      continue;
    }

    const assignedPendingRoomIds = new Set(
      pendingBookings
        .filter((booking) => hasAnyBlockOverlap(candidateBlocks, booking.blocks))
        .flatMap((booking) => booking.assignedRoomIds)
    );
    const pendingUnassignedQuantity = pendingBookings
      .filter((booking) => hasAnyBlockOverlap(candidateBlocks, booking.blocks))
      .reduce((total, booking) => total + pendingConsumesType(booking, request.roomTypeId), 0);
    const availableAfterPending = availableAfterApproved.filter(
      (room) => !assignedPendingRoomIds.has(room.id)
    ).length - pendingUnassignedQuantity;

    if (availableAfterPending < request.quantity) {
      conflicts.push({
        type: "room_type_exhausted",
        severity: "warning",
        message: `Pending requests may use all rooms of type '${roomType?.name ?? request.roomTypeId}' during this time.`,
        roomTypeId: request.roomTypeId,
        roomTypeName: roomType?.name,
      });
    }
  }

  const highestSeverity = highestConflictSeverity(conflicts);
  const available = !conflicts.some(
    (conflict) => conflict.severity === "likely_unavailable"
  );

  return {
    available,
    canSubmit: !conflicts.some(
      (conflict) =>
        conflict.type === "invalid_time" || conflict.type === "duration_rule"
    ),
    highestSeverity,
    summary:
      conflicts.length === 0
        ? "No availability conflicts detected."
        : "This request may not be possible and will require admin review.",
    conflicts,
  };
}
