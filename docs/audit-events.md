# Audit Events

SimHQ stores operational history in immutable `auditEvents` records. Booking timelines and the global audit log both read from this single stream.

## Architecture

- `convex/audit.ts` owns event creation and audit queries.
- Mutations call `recordAuditEvent` after the domain write succeeds.
- Events are append-only and tenant-scoped by `tenantId`.
- Booking events include `bookingId`, which powers per-booking timelines.
- `comments` remain structured entities, and every added comment creates a matching `booking.comment_added` audit event.

## Visibility Rules

- `requester` and `public` events are visible to requesters who can access the booking.
- `staff`, `admin`, and `developer` events are visible only to staff/admin/developer tenant users.
- Global audit queries use `requireStaff`, so staff, admin, and developer users can see all tenant events.
- Requester booking access is checked against requester user id, requester email, or CC email.

## Event Lifecycle

1. Domain mutation validates tenant access and writes the booking/comment change.
2. The mutation records an audit event with actor snapshot, message, metadata, visibility, and optional diff.
3. Timeline and audit pages query `auditEvents` by tenant plus booking, actor, event type, or timestamp indexes.
4. Audit records are not edited when the underlying booking or user changes; actor name/email are snapshots.

## Booking Timeline Behaviour

- Booking detail pages display the audit stream scoped to that booking.
- Comments render as timeline entries using their audit metadata.
- Staff users can expand internal metadata and diffs.
- Public requester tracking only receives requester-visible events and non-internal comments.
