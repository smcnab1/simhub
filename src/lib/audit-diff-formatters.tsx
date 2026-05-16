import { ReactNode } from "react";

export type AuditDiffEntry = {
  field: string;
  before: unknown;
  after: unknown;
};

export type AuditRoomLookup = Record<
  string,
  {
    code?: string | null;
    name?: string | null;
  }
>;

export function formatAllocationStatus(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "Not allocated";
  }

  const labels: Record<string, string> = {
    Unallocated: "Not allocated",
    AutoAllocated: "Auto-allocated",
    ManualReviewRequired: "Needs manual review",
    ManuallyAdjusted: "Manually adjusted",
    Conflict: "Conflict detected",
  };

  return labels[String(value)] ?? String(value);
}

export function formatAuditFieldLabel(field: string) {
  const labels: Record<string, string> = {
    assignedRoomIds: "Rooms assigned",
    allocationStatus: "Allocation status",
    allocationNotes: "Allocation notes",
    status: "Booking status",
    sessionName: "Session name",
    attendeeCount: "Attendee count",
    details: "Details",
  };

  return labels[field] ?? field;
}

export function formatRoomLabel(roomId: string, roomsById: AuditRoomLookup) {
  const room = roomsById[roomId];

  if (!room) return "Unknown room";

  if (room.code && room.name) return `${room.code} - ${room.name}`;
  if (room.code) return room.code;
  if (room.name) return room.name;

  return "Unknown room";
}

export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is string => typeof item === "string");
}

export function getAssignedRoomChanges(
  diff: AuditDiffEntry,
  roomsById: AuditRoomLookup
) {
  const before = new Set(toStringArray(diff.before));
  const after = new Set(toStringArray(diff.after));

  const added = [...after]
    .filter((roomId) => !before.has(roomId))
    .map((roomId) => formatRoomLabel(roomId, roomsById));

  const removed = [...before]
    .filter((roomId) => !after.has(roomId))
    .map((roomId) => formatRoomLabel(roomId, roomsById));

  return { added, removed };
}

export function getAllocationAuditSummary(
  diff: AuditDiffEntry[],
  roomsById: AuditRoomLookup
) {
  const assignedRoomsDiff = diff.find(
    (entry) => entry.field === "assignedRoomIds"
  );

  const allocationStatusDiff = diff.find(
    (entry) => entry.field === "allocationStatus"
  );

  const roomChanges = assignedRoomsDiff
    ? getAssignedRoomChanges(assignedRoomsDiff, roomsById)
    : { added: [], removed: [] };

  const addedCount = roomChanges.added.length;
  const removedCount = roomChanges.removed.length;

  const statusChanged =
    allocationStatusDiff &&
    formatAllocationStatus(allocationStatusDiff.before) !==
      formatAllocationStatus(allocationStatusDiff.after);

  const summaryParts: string[] = [];

  if (addedCount > 0) {
    summaryParts.push(`${addedCount} room${addedCount === 1 ? "" : "s"} assigned`);
  }

  if (removedCount > 0) {
    summaryParts.push(
      `${removedCount} room${removedCount === 1 ? "" : "s"} removed`
    );
  }

  return {
    title: "Room allocation updated",
    summary:
      summaryParts.length > 0
        ? summaryParts.join(", ")
        : statusChanged
          ? "Allocation status changed"
          : "Allocation updated",
    statusText: statusChanged
      ? `Status changed to ${formatAllocationStatus(allocationStatusDiff.after)}`
      : null,
    added: roomChanges.added,
    removed: roomChanges.removed,
  };
}

export function formatGenericAuditValue(value: unknown): ReactNode {
  if (value === null || value === undefined || value === "") return "None";

  if (Array.isArray(value)) {
    if (value.length === 0) return "None";
    return value.join(", ");
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "object") {
    return "Updated";
  }

  return String(value);
}