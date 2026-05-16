import {
  occupiedBookingWindow,
  validateMaxBookingDuration,
  type BookingRange,
  type RoomSelectionMode,
  type RoomTypeBookingRule,
  type RoomTypeRequest,
} from "./booking-logic";

export type RoomAllocationRoom = {
  id: string;
  roomTypeId: string;
  active: boolean;
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
  | "booking_notice"
  | "duration_rule"
  | "exact_room_overlap"
  | "pending_overlap"
  | "room_type_exhausted"
  | "inactive_room"
  | "room_type_mismatch"
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
  conflictingStatus?: "Pending" | "Approved" | "Completed" | "Confirmed";
  blockedTimeId?: string;
  blockedReason?: string;
  overlapStart?: string;
  overlapEnd?: string;
  requestedQuantity?: number;
  availableQuantity?: number;
  missingQuantity?: number;
  unavailableRoomIds?: string[];
  unavailableRooms?: Array<{
    id: string;
    code: string;
    name: string;
    reason: string;
  }>;
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

export type AvailabilityBookingStatus =
  | "Pending"
  | "Approved"
  | "Confirmed"
  | "Completed"
  | "Declined"
  | "Rejected"
  | "Cancelled"
  | "Canceled"
  | "Archived"
  | "Inactive";

export type AvailabilityBooking = {
  id: string;
  status: AvailabilityBookingStatus;
  blocks: BookingRange[];
  assignedRoomIds: string[];
  requestedRoomIds?: string[];
  roomTypeRequests?: RoomTypeRequest[];
};

export type AvailabilityBlockedTime = BookingRange & {
  id: string;
  reason: string;
  active?: boolean;
  archivedAt?: number;
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

export type AutoAllocationStatus =
  | "AutoAllocated"
  | "Conflict"
  | "ManualReviewRequired";

export type AutoAllocationResult = {
  status: AutoAllocationStatus;
  assignedRoomIds: string[];
  conflicts: AvailabilityConflict[];
  notes?: string;
};

const BLOCKING_BOOKING_STATUSES = new Set<AvailabilityBookingStatus>([
  "Approved",
  "Confirmed",
  "Completed",
]);
const WARNING_BOOKING_STATUSES = new Set<AvailabilityBookingStatus>(["Pending"]);
const IGNORED_BOOKING_STATUSES = new Set<AvailabilityBookingStatus>([
  "Declined",
  "Rejected",
  "Cancelled",
  "Canceled",
  "Archived",
  "Inactive",
]);

export function bookingBlocksAvailability(booking: AvailabilityBooking) {
  if (BLOCKING_BOOKING_STATUSES.has(booking.status)) return "blocking";
  if (WARNING_BOOKING_STATUSES.has(booking.status)) return "warning";
  if (IGNORED_BOOKING_STATUSES.has(booking.status)) return "ignored";
  return "ignored";
}

export function blockedTimeIsActive(blockedTime: AvailabilityBlockedTime) {
  return blockedTime.active !== false && blockedTime.archivedAt === undefined;
}

export function rangesOverlap(a: BookingRange, b: BookingRange) {
  return (
    Date.parse(a.start) < Date.parse(b.end) &&
    Date.parse(b.start) < Date.parse(a.end)
  );
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

export function hasAnyBlockOverlap(
  candidateBlocks: BookingRange[],
  existingBlocks: BookingRange[]
) {
  const candidateOccupancy = occupiedBookingWindow(candidateBlocks);
  const existingOccupancy = occupiedBookingWindow(existingBlocks);

  return existingOccupancy.some((existing) =>
    candidateOccupancy.some((candidate) => rangesOverlap(candidate, existing))
  );
}

export function hasBookingConflict(
  candidateBlocks: BookingRange[],
  existingBookings: AssignedBooking[]
) {
  return existingBookings.some((booking) =>
    hasAnyBlockOverlap(candidateBlocks, booking.blocks)
  );
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

function roomIsBlockedBy(
  blockedTime: AvailabilityBlockedTime,
  room: AvailabilityRoom
) {
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
  return blockedTimes.filter(blockedTimeIsActive).flatMap((blockedTime) =>
    blocks
      .map((block) => overlapBounds(block, blockedTime))
      .filter(
        (overlap): overlap is { overlapStart: string; overlapEnd: string } =>
          overlap !== null
      )
      .map((overlap) => ({ blockedTime, overlap }))
  );
}

function roomUnavailableForBlocking(
  room: AvailabilityRoom,
  blocks: BookingRange[],
  blockingBookings: AvailabilityBooking[],
  blockedTimes: AvailabilityBlockedTime[]
) {
  return (
    blockingBookings.some(
      (booking) =>
        bookingConsumesRoom(booking, room) &&
        hasAnyBlockOverlap(blocks, booking.blocks)
    ) ||
    blockedTimes.some(
      (blockedTime) =>
        blockedTimeIsActive(blockedTime) &&
        roomIsBlockedBy(blockedTime, room) &&
        hasAnyBlockOverlap(blocks, [blockedTime])
    )
  );
}

function blockingRoomReason(args: {
  room: AvailabilityRoom;
  blocks: BookingRange[];
  blockingBookings: AvailabilityBooking[];
  blockedTimes: AvailabilityBlockedTime[];
}) {
  for (const booking of args.blockingBookings) {
    if (!bookingConsumesRoom(booking, args.room)) continue;
    if (!hasAnyBlockOverlap(args.blocks, booking.blocks)) continue;

    return {
      reason: "Overlapping approved booking",
      booking,
    };
  }

  for (const blockedTime of args.blockedTimes) {
    if (!blockedTimeIsActive(blockedTime)) continue;
    if (!roomIsBlockedBy(blockedTime, args.room)) continue;
    if (!hasAnyBlockOverlap(args.blocks, [blockedTime])) continue;

    return {
      reason: blockedTime.reason || "Blocked period",
      blockedTime,
    };
  }

  return null;
}

function pendingConsumesType(booking: AvailabilityBooking, roomTypeId: string) {
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
  const roomTypeById = new Map(
    input.roomTypes.map((roomType) => [roomType.id, roomType])
  );
  const campusById = new Map(
    (input.campuses ?? []).map((campus) => [campus.id, campus])
  );
  const activeBlockedTimes = (input.blockedTimes ?? []).filter(blockedTimeIsActive);
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
    input.blocks,
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

  const blockingBookings = input.bookings.filter(
    (booking) => bookingBlocksAvailability(booking) === "blocking"
  );
  const pendingBookings = input.bookings.filter(
    (booking) => bookingBlocksAvailability(booking) === "warning"
  );

  for (const roomId of input.requestedRoomIds ?? []) {
    const room = roomById.get(roomId);
    if (!room) continue;

    if (!room.active) {
      conflicts.push({
        type: "inactive_room",
        severity: "warning",
        message: `${room.code} is inactive and should be reviewed before assignment.`,
        roomId: room.id,
        roomCode: room.code,
        roomName: room.name,
        roomTypeId: room.roomTypeId,
      });
    }

    const requestedRoomTypeIds = new Set(
      input.roomTypeRequests
        .filter((request) => request.quantity > 0)
        .map((request) => request.roomTypeId)
    );

    if (
      requestedRoomTypeIds.size > 0 &&
      !requestedRoomTypeIds.has(room.roomTypeId)
    ) {
      const roomType = roomTypeById.get(room.roomTypeId);

      conflicts.push({
        type: "room_type_mismatch",
        severity: "warning",
        message: `${room.code} is not one of the requested room types.`,
        roomId: room.id,
        roomCode: room.code,
        roomName: room.name,
        roomTypeId: room.roomTypeId,
        roomTypeName: roomType?.name,
      });
    }

    for (const booking of blockingBookings) {
      if (!bookingConsumesRoom(booking, room)) continue;

      for (const block of candidateBlocks) {
        for (const existingBlock of occupiedBookingWindow(booking.blocks)) {
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
            conflictingStatus:
              booking.status === "Completed"
                ? "Completed"
                : booking.status === "Confirmed"
                  ? "Confirmed"
                  : "Approved",
            ...overlap,
          });
        }
      }
    }

    for (const booking of pendingBookings) {
      if (!bookingConsumesRoom(booking, room)) continue;

      for (const block of candidateBlocks) {
        for (const existingBlock of occupiedBookingWindow(booking.blocks)) {
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
    activeBlockedTimes
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
      type:
        blockedTime.campusId && !blockedTime.roomId && !blockedTime.roomTypeId
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

  if (roomSelectionMode === "RoomTypeQuantity") {
    for (const request of input.roomTypeRequests) {
      if (request.quantity <= 0) continue;

      const roomType = roomTypeById.get(request.roomTypeId);
      const activeRoomsForType = input.rooms.filter(
        (room) => room.active && room.roomTypeId === request.roomTypeId
      );
      const availableAfterBlocking = activeRoomsForType.filter(
        (room) =>
          !roomUnavailableForBlocking(
            room,
            candidateBlocks,
            blockingBookings,
            activeBlockedTimes
          )
      );

      if (availableAfterBlocking.length < request.quantity) {
        conflicts.push({
          type: "room_type_exhausted",
          severity: "likely_unavailable",
          message: `All rooms of type '${roomType?.name ?? request.roomTypeId}' are currently allocated.`,
          roomTypeId: request.roomTypeId,
          roomTypeName: roomType?.name,
          requestedQuantity: request.quantity,
          availableQuantity: availableAfterBlocking.length,
          missingQuantity: Math.max(0, request.quantity - availableAfterBlocking.length),
        });
        continue;
      }

      const overlappingPendingBookings = pendingBookings.filter((booking) =>
        hasAnyBlockOverlap(candidateBlocks, booking.blocks)
      );
      const assignedPendingRoomIds = new Set(
        overlappingPendingBookings.flatMap((booking) => booking.assignedRoomIds)
      );
      const pendingUnassignedQuantity = overlappingPendingBookings.reduce(
        (total, booking) => total + pendingConsumesType(booking, request.roomTypeId),
        0
      );
      const availableAfterPending =
        availableAfterBlocking.filter((room) => !assignedPendingRoomIds.has(room.id))
          .length - pendingUnassignedQuantity;

      if (availableAfterPending < request.quantity) {
        conflicts.push({
          type: "room_type_exhausted",
          severity: "warning",
          message: `Pending requests may use all rooms of type '${roomType?.name ?? request.roomTypeId}' during this time.`,
          roomTypeId: request.roomTypeId,
          roomTypeName: roomType?.name,
          requestedQuantity: request.quantity,
          availableQuantity: Math.max(0, availableAfterPending),
          missingQuantity: Math.max(0, request.quantity - availableAfterPending),
        });
      }
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

export function autoAllocateRooms(
  input: AvailabilityCheckInput
): AutoAllocationResult {
  if ((input.roomSelectionMode ?? "RoomTypeQuantity") !== "RoomTypeQuantity") {
    return {
      status: "ManualReviewRequired",
      assignedRoomIds: input.requestedRoomIds ?? [],
      conflicts: [],
      notes: "Specific room requests preserve requester/admin room selection.",
    };
  }

  const candidateBlocks = occupiedBookingWindow(input.blocks);
  const roomTypeById = new Map(
    input.roomTypes.map((roomType) => [roomType.id, roomType])
  );
  const blockingBookings = input.bookings.filter(
    (booking) => bookingBlocksAvailability(booking) === "blocking"
  );
  const activeBlockedTimes = (input.blockedTimes ?? []).filter(blockedTimeIsActive);
  const selectedRoomIds = new Set<string>();
  const assignedRoomIds: string[] = [];
  const conflicts: AvailabilityConflict[] = [];

  for (const request of input.roomTypeRequests) {
    if (request.quantity <= 0) continue;

    const roomType = roomTypeById.get(request.roomTypeId);
    const eligibleRooms = input.rooms
      .filter((room) => {
        if (!room.active || room.roomTypeId !== request.roomTypeId) return false;
        if (roomType?.campusId && room.campusId !== roomType.campusId) return false;
        return !selectedRoomIds.has(room.id);
      })
      .sort((a, b) =>
        a.code.localeCompare(b.code) ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id)
      );
    const availableRooms = eligibleRooms.filter(
      (room) =>
        !roomUnavailableForBlocking(
          room,
          candidateBlocks,
          blockingBookings,
          activeBlockedTimes
        )
    );

    if (availableRooms.length >= request.quantity) {
      for (const room of availableRooms.slice(0, request.quantity)) {
        selectedRoomIds.add(room.id);
        assignedRoomIds.push(room.id);
      }
      continue;
    }

    const unavailableRooms = eligibleRooms
      .map((room) => {
        const conflict = blockingRoomReason({
          room,
          blocks: candidateBlocks,
          blockingBookings,
          blockedTimes: activeBlockedTimes,
        });

        return conflict
          ? {
              id: room.id,
              code: room.code,
              name: room.name,
              reason: conflict.reason,
            }
          : null;
      })
      .filter(
        (
          room
        ): room is { id: string; code: string; name: string; reason: string } =>
          room !== null
      );

    conflicts.push({
      type: "room_type_exhausted",
      severity: "likely_unavailable",
      message: `Only ${availableRooms.length} of ${request.quantity} requested '${roomType?.name ?? request.roomTypeId}' room(s) could be auto-allocated.`,
      roomTypeId: request.roomTypeId,
      roomTypeName: roomType?.name,
      requestedQuantity: request.quantity,
      availableQuantity: availableRooms.length,
      missingQuantity: Math.max(0, request.quantity - availableRooms.length),
      unavailableRoomIds: unavailableRooms.map((room) => room.id),
      unavailableRooms,
    });
  }

  if (conflicts.length > 0) {
    return {
      status: "Conflict",
      assignedRoomIds,
      conflicts,
      notes: "Automatic allocation could not satisfy every requested room quantity.",
    };
  }

  return {
    status: "AutoAllocated",
    assignedRoomIds,
    conflicts: [],
    notes: "Rooms were automatically allocated from the requested room type quantities.",
  };
}
