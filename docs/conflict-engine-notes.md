# Central Conflict Engine Notes

## Audit Findings

- A partial central checker already existed in `src/lib/booking-logic.ts` as `checkAvailabilityConflicts`.
- The requester booking flow, admin request detail recomputation, request creation, and status updates already called that checker through `computeAvailability` in `convex/bookings.ts`.
- The legacy `validateAvailability` Convex action still duplicated the older path: approved-booking lookup, `hasBookingConflict`, and `allocateRoomsByType`. That skipped blocked times and did not return structured conflict details.
- Low-level overlap helpers were mixed into general booking rules, making it easy for future code to bypass blocked-time/status handling.

## Central Engine

`src/lib/conflict-engine.ts` is now the single reusable service for conflict decisions. It owns:

- range overlap checks
- occupancy-window comparison
- room allocation checks
- room type quantity exhaustion
- booking status filtering
- blocked-time matching
- structured conflict result typing

Consumers should call `checkAvailabilityConflicts` instead of calculating overlaps directly.

## Occupancy Logic

Availability compares the full occupied booking window:

`setupStart -> cleanupEnd`

The engine normalizes candidate and existing booking blocks through `occupiedBookingWindow`, so a setup/session/cleanup sequence of 08:00-09:00, 09:00-17:00, and 17:00-18:00 blocks availability for 08:00-18:00.

Session-only duration rules still use the session block through `validateMaxBookingDuration`, so setup and cleanup do not count against a room type's max booking duration.

## Status Handling

Blocking statuses:

- `Approved`
- `Confirmed`
- `Completed`

Warning statuses:

- `Pending`

Ignored statuses:

- `Declined`
- `Rejected`
- `Cancelled`
- `Canceled`
- `Archived`
- `Inactive`

Current Convex booking records use `Approved`, `Pending`, `Completed`, `Declined`, and `Cancelled`. The engine accepts the wider status set so future status naming does not create another local overlap implementation.

## Blocked-Time Integration

Blocked periods are checked through the same overlap engine as bookings. They can apply by:

- exact room
- room type
- campus
- tenant-wide scope when no room, room type, or campus is set

Inactive or archived blocked-time records are ignored when those fields are present. Current Convex blocked-time records do not yet expose active/archive fields, so existing records are treated as active.

## Warning vs Blocking Behaviour

Hard conflicts use `likely_unavailable` and make `available` false. Pending bookings produce `warning` conflicts so a requester can still submit for staff review unless another validation rule blocks submission.

`canSubmit` only blocks for invalid time and duration-rule conflicts. Notice-window validation is layered in Convex through `availabilityWithNoticeEvaluation`.
