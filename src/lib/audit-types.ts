export const auditEventTypes = [
  "booking.created",
  "booking.updated",
  "booking.status_changed",
  "booking.approved",
  "booking.declined",
  "booking.cancelled",
  "booking.archived",
  "booking.deleted",
  "booking.allocation_changed",
  "booking.allocation_override",
  "booking.conflict_detected",
  "booking.comment_added",
  "booking.comment_edited",
  "booking.comment_deleted",
  "blocked_time.created",
  "blocked_time.updated",
  "blocked_time.deleted",
] as const;

export const auditEntityTypes = [
  "booking",
  "comment",
  "room",
  "roomType",
  "campus",
  "blockedTime",
  "tenant",
  "user",
  "system",
] as const;

export const auditVisibilityLevels = ["public", "requester", "staff", "admin", "developer"] as const;

export const auditSeverityLevels = ["info", "warning", "critical"] as const;

export type AuditEventType = (typeof auditEventTypes)[number];
export type AuditEntityType = (typeof auditEntityTypes)[number];
export type AuditVisibilityLevel = (typeof auditVisibilityLevels)[number];
export type AuditSeverityLevel = (typeof auditSeverityLevels)[number];

export type AuditDiffEntry = {
  field: string;
  before: unknown;
  after: unknown;
};

export function auditEventLabel(eventType: string) {
  return eventType
    .split(".")
    .map((part) => part.replaceAll("_", " "))
    .join(" ");
}
