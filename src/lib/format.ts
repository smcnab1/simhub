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

export function formatDateTime(value: string, timezone = "Europe/London") {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(date);
}

export function formatTime(value: string, timezone = "Europe/London") {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: timezone,
  }).format(date);
}

export function formatTimeRange(
  start: string,
  end: string,
  timezone = "Europe/London"
) {
  return `${formatTime(start, timezone)} to ${formatTime(end, timezone)}`;
}

export function formatBlockTime(
  block: { start: string; end: string },
  timezone = "Europe/London"
) {
  return `${formatDateTime(block.start, timezone)} to ${formatTime(block.end, timezone)}`;
}

export function formatRequestDate(request: { blocks: Array<{ start: string }>; timezone?: string }) {
  const start = request.blocks[0]?.start;

  if (!start) {
    return "No date";
  }

  return formatDateTime(start, request.timezone);
}
