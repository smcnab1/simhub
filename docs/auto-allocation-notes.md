# Auto Allocation Notes

## Allocation Workflow

Room type quantity requests are auto-allocated during request creation after availability and booking notice validation.

1. The request's setup/session/cleanup blocks are normalized to the occupied window.
2. Tenant-scoped rooms, room types, campuses, blocking bookings, pending bookings, and blocked times are loaded.
3. `autoAllocateRooms` in `src/lib/conflict-engine.ts` selects active rooms for each requested room type.
4. If every quantity can be satisfied, assigned room ids are stored and `allocationStatus` is set to `AutoAllocated`.
5. If any quantity cannot be satisfied, available rooms may be partially assigned and `allocationStatus` is set to `Conflict`.

Specific-room requests are not auto-reassigned. They preserve the requester/admin selection path and remain available for manual staff review.

## Eligibility Rules

The allocator only selects rooms that are:

- active
- in the requested room type
- in the requested campus when the room type has a campus/site
- not already selected for another requested quantity in the same request
- not occupied by overlapping blocking bookings
- not covered by active blocked times

Rooms are ordered by code, then name, then id so automatic allocation is stable and predictable.

## Conflict States

Allocation statuses:

- `AutoAllocated`: every requested room quantity was assigned.
- `Conflict`: one or more requested quantities could not be fully assigned.
- `ManualReviewRequired`: reserved for flows where automatic assignment should not choose rooms.
- `ManuallyAdjusted`: set when staff submit an explicit room assignment.
- `Unallocated`: no automatic/manual allocation has been made.

Allocation conflicts are returned as structured `room_type_exhausted` conflicts with requested, available, and missing quantities plus unavailable room details when known.

## Occupancy Overlap Handling

Allocation uses the same central conflict engine as availability. All overlap decisions compare the occupied booking window:

`setupStart -> cleanupEnd`

This means setup and cleanup time block room allocation exactly like session time.

## Manual Fallback

Admin status updates preserve manual allocation. When `assignedRoomIds` are passed to `updateStatus`, the request is marked `ManuallyAdjusted` and the central engine recomputes conflicts for that explicit room set.

The request detail screen shows allocation status, auto-assigned rooms, missing quantities, unavailable room reasons, and an active-room checklist for staff to override or reassign rooms manually.
