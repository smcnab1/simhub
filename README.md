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
