# Manual Allocation Notes

## Manual Allocation Workflow

Staff, Admin, and Developer users can edit allocation from the booking request detail page.

The UI supports:

- searching rooms by name, code, room type, or campus
- adding and removing multiple assigned rooms
- reviewing assigned room chips before save
- editing allocation notes
- saving or cancelling unsaved changes

Public/requester views remain read-only.

## Conflict Warning Behaviour

Manual allocation uses `previewManualAllocation`, which calls the same central conflict engine as auto-allocation and availability checks.

Warnings appear before save for:

- overlaps with approved, confirmed, or completed bookings
- blocked/unavailable periods
- inactive rooms
- selected rooms outside the requested room types
- pending overlaps as warning-level conflicts

The overlap window is always the full occupancy window:

`setupStart -> cleanupEnd`

Warnings do not prevent staff from saving a manual override. They are stored back into `conflictMetadata` so the request detail page keeps the warning context visible after save.

## Allocation Status Transitions

- Auto allocation success sets `allocationStatus = "AutoAllocated"`.
- Auto allocation failure sets `allocationStatus = "Conflict"`.
- Manual save sets `allocationStatus = "ManuallyAdjusted"`.
- Workflow status changes preserve the current allocation status unless explicit assigned rooms are also sent.

## Audit Metadata

Manual allocation saves populate:

- `allocationNotes`
- `allocationUpdatedByUserId`
- `allocationUpdatedAt`

The request detail page displays the last allocation editor and timestamp when available.
