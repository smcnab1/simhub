export type BookingRange = {
  start: string;
  end: string;
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

export type RoomTypeBookingRule = {
  id: string;
  name: string;
  maxBookingDurationMinutes?: number;
};

export type AssignedBooking = {
  blocks: BookingRange[];
  assignedRoomIds: string[];
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

export function rangesOverlap(a: BookingRange, b: BookingRange) {
  return Date.parse(a.start) < Date.parse(b.end) && Date.parse(b.start) < Date.parse(a.end);
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
