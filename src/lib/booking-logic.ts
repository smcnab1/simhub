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
