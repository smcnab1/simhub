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
