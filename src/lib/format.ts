export function formatRooms(request: {
  roomSelectionMode?: "SpecificRooms" | "RoomTypeQuantity";
  assignedRooms?: Array<{ name: string; code?: string }>;
  requestedRooms?: Array<{ name: string; code?: string }>;
  roomTypeRequestDetails?: Array<{ roomTypeName: string; quantity: number }>;
  roomTypeRequests?: Array<{ quantity: number }>;
}) {
  if (request.assignedRooms?.length) {
    return request.assignedRooms.map((room) => room.code ? `${room.name} (${room.code})` : room.name).join(", ");
  }

  if (request.requestedRooms?.length) {
    return request.requestedRooms.map((room) => room.code ? `${room.name} (${room.code})` : room.name).join(", ");
  }

  if (request.roomTypeRequestDetails?.length) {
    return request.roomTypeRequestDetails
      .map((request) => `${request.quantity} ${request.roomTypeName}${request.quantity === 1 ? "" : "s"}`)
      .join(", ");
  }

  return "Unassigned";
}

export function formatRequestDate(request: { blocks: Array<{ start: string }> }) {
  return request.blocks[0]?.start.slice(0, 10) ?? "No date";
}
