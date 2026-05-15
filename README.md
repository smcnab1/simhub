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
