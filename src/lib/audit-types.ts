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
  "tenant.created",
  "user.invited",
  "user.created",
  "membership.assigned",
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
  const labels: Record<string, string> = {
    "booking.created": "Booking Created",
    "booking.updated": "Booking Updated",
    "booking.status_changed": "Status Changed",
    "booking.approved": "Booking Approved",
    "booking.declined": "Booking Declined",
    "booking.cancelled": "Booking Cancelled",
    "booking.archived": "Booking Archived",
    "booking.deleted": "Booking Deleted",
    "booking.allocation_changed": "Room Allocation Changed",
    "booking.allocation_override": "Room Allocation Overridden",
    "booking.conflict_detected": "Conflict Detected",
    "booking.comment_added": "Comment Added",
    "booking.comment_edited": "Comment Edited",
    "booking.comment_deleted": "Comment Deleted",
    "blocked_time.created": "Blocked Time Created",
    "blocked_time.updated": "Blocked Time Updated",
    "blocked_time.deleted": "Blocked Time Deleted",
    "tenant.created": "Tenant Created",
    "user.invited": "User Invited",
    "user.created": "User Created",
    "membership.assigned": "Membership Assigned",
  };

  if (labels[eventType]) return labels[eventType];

  return eventType
    .split(".")
    .map((part) => part.replaceAll("_", " "))
    .join(" ")
    .replace(/\w\S*/g, (word) => {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
}
