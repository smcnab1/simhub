export function formatRooms(request: { assignedRooms?: Array<{ name: string; code?: string }> }) {
  return request.assignedRooms?.length
    ? request.assignedRooms.map((room) => room.code ? `${room.name} (${room.code})` : room.name).join(", ")
    : "Unassigned";
}

export function formatRequestDate(request: { blocks: Array<{ start: string }> }) {
  return request.blocks[0]?.start.slice(0, 10) ?? "No date";
}
