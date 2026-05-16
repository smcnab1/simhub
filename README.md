# SimHub

SimHub is a multi-tenant simulation centre booking SaaS foundation built with Next.js App Router, TypeScript, Tailwind CSS, Convex, and WorkOS AuthKit.

## Product Surface

- Public landing page, monthly calendar, booking request wizard, and requester tracking.
- Admin/Staff dashboard focused on requests, notifications, resource calendar, and administration.
- Administration covers facility settings, room types and quantities, request form configuration, and accounts.
- Convex backend covers tenants, users, rooms, booking requests, comments, notifications, file uploads, and blocked times.

## Getting Started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Convex

The local `.env.local` is configured for:

- `https://giddy-boar-851.eu-west-1.convex.cloud`
- `https://giddy-boar-851.eu-west-1.convex.site`

Useful commands:

```bash
npx convex dev --once
```

## Campus Lifecycle and Sorting

Campuses/sites are tenant-scoped locations managed by Admins and Developers at
`/dashboard/admin/campuses`. Campus names are required and unique within a
tenant. Optional structured location fields are available for future location
use: `addressLine1`, `addressLine2`, `city`, `region`, `postalCode`,
`country`, and free-form `details` for access notes, reception instructions, or
parking guidance. `sortOrder` controls manual ordering; lower numbers appear
first, and campuses without a sort order fall back to alphabetical order after
numbered campuses.

Campus archive is always a soft delete. The existing `tenants.deleteCampus`
mutation is intentionally archive-only and sets `active: false`; it never
physically removes the campus document. Historic rooms, bookings, calendars,
and reports can continue to resolve the campus link. Inactive campuses are
hidden from public/requester booking flows and new availability validation, but
admin views can request `activeOnly: false` to show both active and inactive
sites.

For older campus data, run `tenants.backfillCampusManagementFields` per tenant
to set missing `active` values to `true` and assign predictable sort orders in
the current display order.

## Room Lifecycle

Rooms are tenant-scoped physical spaces such as `PH900`, `PH901`, and `PH902`.
Room codes are normalized to uppercase and must be unique within a tenant.

Admins and Developers manage rooms from `/dashboard/admin/rooms`. Archiving a
room sets `active: false`; rooms are not hard deleted so historic bookings can
still render their assigned room names and codes. Archived rooms are hidden from
new booking choices and the default admin/resource views, but admins can switch
the room admin status filter to view or reactivate archived rooms.

Room images are stored in Convex file storage. Updating a room preserves its
current image unless a new image is uploaded or the image is explicitly removed.

## Room Type Lifecycle

Room types are tenant-scoped categories such as `Classroom`, `Ward`,
`Immersive Room`, and `Control Room`. Admins and Developers manage them from
`/dashboard/admin/room-types`.

Room type archive is always a soft delete: `deleteRoomType` only sets
`active: false`. Existing rooms can keep their inactive type and historic
bookings continue to render, but inactive room types are hidden from new room
creation/edit choices unless the edited room is already assigned to that type.

The canonical booking-rule fields are `specialRoom` and
`maxBookingDurationMinutes`. `specialRoom` is exposed in admin UI for future
filtering/rules. When `maxBookingDurationMinutes` is set, public booking
creation and availability validation reject requests whose total booking span
from earliest block start to latest block end exceeds that limit for any
selected room type.

Older data with `isSpecial` or `maxDurationHours` is still read. Run the
`tenants.backfillRoomTypeManagementFields` Convex mutation per tenant to copy
legacy values into the canonical fields and clear the legacy fields.

## Availability Conflict Warnings

Requester-side availability checks are advisory. The public booking form calls
the tenant-scoped `bookings.checkRequestAvailability` query after the requester
has selected room quantities and a complete date/time range. The query returns
structured conflict metadata with `informational`, `warning`, or
`likely_unavailable` severity. Warnings are shown inline, but requesters can
still submit pending requests unless an impossible business rule is violated,
such as invalid time ranges or a room type max-duration rule.

The reusable conflict engine lives in `src/lib/booking-logic.ts` and is reused
by Convex queries and mutations. It checks approved bookings, pending bookings
as lower-severity pressure, blocked periods, exact room clashes, campus/site
blocks, and room type exhaustion. Cancelled and declined bookings are ignored.
Datetime comparison is done from ISO strings with `Date.parse`, so overlap
checks compare instants rather than local display text.

`bookings.createRequest` recomputes availability on the server and stores
`conflictMetadata` on the request for admin review. Admin request detail pages
also recompute current conflicts while excluding the request itself, so stale
requests can be assessed against the latest approved bookings, pending
requests, and blocked times. Approval remains an admin decision and is not
blocked by advisory availability warnings.

## Room Request Modes

Booking requests support two requester selection modes using the existing
`bookingRequests` fields:

- `SpecificRooms`: `requestedRoomIds` contains the exact active rooms the
  requester asked for, and `roomTypeRequests` is empty.
- `RoomTypeQuantity`: `roomTypeRequests` contains room type plus quantity pairs,
  and `requestedRoomIds` is empty.

The requester form exposes both modes with a segmented control. Specific room
mode shows active rooms only, with room code, type, campus, and capacity.
Room type quantity mode shows active room types only, with active room counts,
descriptions, default capacity guidance, and quantity controls. The form shows
estimated capacity totals for either mode. Room types also carry standard setup
and cleanup buffers, defaulting to 30 minutes each. Admins can adjust these per
room type for more complex spaces.

Convex validates the mode-specific state before insertion via shared
`validateRoomSelectionState` logic and server-side tenant checks. Mixed states
are rejected, inactive rooms/types are not accepted for new requests, and
historic requests still render from assigned rooms, requested rooms, or stored
room type request details.

## Requester Submission Lifecycle

The public `/book` flow does not require staff/admin access. Guests and signed
in requesters submit through the same `bookings.createRequest` mutation, scoped
by `tenantSlug`. The mutation validates requester contact fields, required
tenant-configured custom fields, room selection state, active room/type/campus
availability, session chronology, public opening hours, and staff
setup/cleanup hours before creating a `Pending` request and notification.

Time is stored as three booking blocks: `Setup`, `Session`, and `Cleanup`, each
with its own start/end. Requesters only enter the session date, start, and
finish. Convex derives setup and cleanup automatically from the selected room
type standards, using the largest setup/cleanup buffer when multiple types are
selected. Availability checks use the total occupied window from setup start
through cleanup end, so staff see conflicts for the complete period that rooms
are unavailable. Maximum room type duration rules count the session block only,
not the automatically-added setup or cleanup buffers.

Facility hours support separate public and staff windows. Public opening hours
control the requester-entered session start/finish. Staff hours control whether
the derived setup and cleanup can fit around that session. The default is public
09:00-17:00 and staff 08:30-17:30.

Booking notice windows are tenant settings on `tenants`:
`minimumAdvanceBookingDays`, `maximumAdvanceBookingDays`, and
`bookingNoticeViolationMode`. Notice checks compare the session start date
against today's date in the tenant timezone. Public/requester submissions are
blocked when the mode is `Block`; in `Warn` mode they can submit as Pending and
the request is marked as requiring additional approval. Staff, Admin, and
Developer roles can acknowledge an override when the booking UI is used with
dashboard auth, and the request stores `bookingNoticeMetadata` for admin review.

Duration calculations are intentionally split. Occupancy/reservation uses the
full setup-through-cleanup window for room availability. Session duration uses
only the `Session` block for requester-visible session length. Validation
duration also uses the `Session` block, so room type maximum duration rules do
not count setup or cleanup buffers.

Guest ownership is email-based. `requesterEmail` is normalized and stored on
the request. If a matching tenant user already exists, `requesterUserId` is set
at submission time. Signed-in requester views can use `bookings.listMyRequests`,
which returns requests linked by `requesterUserId` or by matching email, so
requests made before account creation can still appear after the account is
linked with the same email address.

Public tracking uses booking reference plus requester email through
`bookings.getPublicRequestByReference`. The tracking URL can include
`?email=...` after submission; otherwise the tracking page asks for the email
before showing requester-visible request details.

## Local Bootstrap and Seeding

For a first local setup, add your WorkOS email to `.env.local` so the seeded
Developer account matches the account you sign in with. If you use a bootstrap
token, put the same value in `.env.local` and the Convex environment:

```bash
SIMHUB_ENV=development
SIMHUB_BOOTSTRAP_TOKEN=optional-shared-secret
SIMHUB_DEVELOPER_EMAIL=you@example.com
SIMHUB_SEED_ADMIN_EMAIL=admin@example.local
NEXT_PUBLIC_SIMHUB_TENANT_SLUG=university-of-nothing
```

Set `SIMHUB_ALLOW_BOOTSTRAP=true` in the Convex environment used by
`npm run bootstrap`. Set `SIMHUB_BOOTSTRAP_TOKEN` there too if you want the
extra shared-secret check.

Then run:

```bash
npm run bootstrap
```

This idempotently creates the demo tenant `University of Nothing`, campuses
`Brentford` and `Reading`, room types `Ward`, `Classroom`, and `Skills Lab`,
example rooms, an Admin user, and a platform-owner Developer user. The current
WorkOS flow authenticates seeded users by exact WorkOS user ID when provided, or
by email fallback otherwise.

Use `npm run seed` to re-apply the same demo data after schema or fixture
changes. To reset the seeded tenant in a local/dev Convex deployment, first set
`SIMHUB_ALLOW_DEV_RESET=true` in the Convex environment, optionally set
`SIMHUB_DEV_RESET_TOKEN`, then run:

```bash
npm run reset:dev
npm run bootstrap
```

Dev reset is guarded by `SIMHUB_ENV`/`NODE_ENV`/`VERCEL_ENV`, refuses production
deployments, requires the confirmation phrase baked into the script, and will
only run when the Convex environment has `SIMHUB_ALLOW_DEV_RESET=true`.

## WorkOS

Set these values in `.env.local` when ready to enforce authentication:

```bash
WORKOS_CLIENT_ID=client_...
WORKOS_API_KEY=sk_test_...
WORKOS_COOKIE_PASSWORD=replace-with-at-least-32-characters
NEXT_PUBLIC_WORKOS_REDIRECT_URI=http://localhost:3000/auth/callback
WORKOS_SIGN_IN_ENDPOINT=http://localhost:3000/auth/sign-in
```

Configure the WorkOS sign-in endpoint as `http://localhost:3000/auth/sign-in` and callback as `http://localhost:3000/auth/callback`. The public “Staff sign in” link points to `/auth/sign-in`, and AuthKit returns to `/dashboard` after `/auth/callback`. Use user metadata role values of `Admin`, `Staff`, or `Requester`; only Admin and Staff should access `/dashboard`.

Convex auth is configured with WorkOS issuer/client values from the deployment environment.
