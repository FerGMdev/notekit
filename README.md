# Notekit

A notes app built as a real product, not a tutorial: private notes, a free plan
that is enforced on the server, and a codebase you can reason about.

> **Status:** early but production-minded. The product surface (markdown editor,
> tags, search, AI) is being built in the open; the foundations — authorisation,
> validation, migrations, tests and CI — are already in place.

---

## What it does today

- **Authentication** with Kinde (sign up, sign in, session handling).
- **Notes CRUD** scoped to the signed-in account, with server-side ownership
  checks on every read and write.
- **Markdown content** stored as portable text (rendering lands with the editor).
- **Free plan with a real limit** — 10 notes — plus a Pro plan for unlimited
  notes. The limit is enforced in the domain layer, not by hiding buttons.
- **Stripe billing** — Checkout, Customer Portal and signed webhooks, with a
  `mock` provider so the app is fully usable without Stripe keys.
- **Per-user theming** — light/dark plus seven accent schemes.
- **Failure UX** — error boundaries, a real 404 page, loading skeletons and
  accessible form feedback.

## Architecture

```
app/
├── dashboard/              # Auth-gated area (force-dynamic)
│   ├── notes/[id]/         # Edit a note
│   ├── new/                # Create a note
│   ├── billing/            # Plans + subscription management
│   ├── settings/           # Profile + colour scheme
│   ├── loading.tsx         # Streamed skeleton
│   ├── layout.tsx          # Session guard + user sync
│   └── page.tsx            # Notes list
├── lib/
│   ├── auth.ts             # The only place that knows about the identity provider
│   ├── notes.ts            # Note domain layer (ownership + plan rules)
│   ├── billing.ts          # Stripe or mock, chosen by config
│   ├── users.ts            # User mirroring + first-run welcome note
│   ├── env.ts              # Validated, typed environment
│   ├── url.ts              # Absolute URLs for redirects
│   └── db.ts               # Prisma singleton
├── api/webhook/stripe/     # Signature-verified webhook
└── page.tsx                # Landing
```

### Three decisions worth explaining

**1. Authorisation lives next to the data, not in the UI.**
`app/lib/notes.ts` takes a `userId` on every function and filters by it inside
the query (`where: { id, userId }`). Calling `deleteNote(user.id, noteId)` with
another account's note updates/deletes zero rows and throws `NoteNotFoundError`.
A missing note and someone else's note are deliberately indistinguishable.

**2. Billing is a provider, not a hard dependency.**
`app/lib/billing.ts` exposes `createCheckoutUrl`, `createPortalUrl` and
`getSubscriptionStatus`. With `BILLING_PROVIDER=stripe` it talks to Stripe; with
`mock` it flips a local subscription row so reviewers can explore the Pro state
without keys or a card. Stripe's client is created lazily, so a missing key no
longer crashes the app at import time.

**3. The database is migrated, not pushed.**
`prisma/migrations/` is committed. `prisma migrate deploy` is the deployment
step, and `prisma/seed.ts` provides deterministic fixtures for development and
tests. Note ownership is a required foreign key with `ON DELETE CASCADE`, so
orphan notes cannot exist.

## Security model

| Risk | Mitigation |
| --- | --- |
| IDOR on notes | Every query filters by `userId`; cross-account access is a 404. |
| Paywall bypass | The free-plan limit is checked inside `createNote`, not in JSX. |
| Untrusted input | Zod schemas at the boundary (`title` ≤ 120 chars, `content` ≤ 50k). |
| Forged webhooks | Stripe signature verification is mandatory; the route is 503 without a secret. |
| Misconfiguration | `app/lib/env.ts` validates the environment once and fails loudly. |
| Privilege escalation | Dashboard routes are auth-gated server-side; actions re-read the session. |

## Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 15 (App Router, Server Components, Server Actions) |
| Language | TypeScript (strict) |
| Database | PostgreSQL (Neon-compatible) + Prisma |
| Auth | Kinde |
| Payments | Stripe (optional) |
| UI | Tailwind CSS + shadcn/ui (Radix) |
| Tests | Vitest against a real Postgres database |

## Getting started

### Prerequisites

- Node.js 20+ (Node 24 tested)
- npm
- A PostgreSQL database ([Neon](https://neon.tech/) free tier works)
- A Kinde application (only needed to sign in)

### 1. Install

```bash
git clone https://github.com/FerGMdev/my-note-saas-app.git
cd my-note-saas-app
npm install
```

### 2. Configure

```bash
cp .env.example .env
```

Minimum to boot: `DATABASE_URL` and `DIRECT_URL`. Set
`BILLING_PROVIDER="mock"` to skip Stripe entirely.

### 3. Create the schema

```bash
npx prisma migrate deploy   # apply committed migrations
npm run db:seed             # optional fixtures
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Pooled PostgreSQL URL used at runtime. |
| `DIRECT_URL` | ✅ | Direct URL used by Prisma Migrate. |
| `KINDE_CLIENT_ID` | ✅ to sign in | Kinde application client ID. |
| `KINDE_CLIENT_SECRET` | ✅ to sign in | Kinde client secret. |
| `KINDE_ISSUER_URL` | ✅ to sign in | Your Kinde domain. |
| `KINDE_SITE_URL` | ✅ to sign in | Public app URL. |
| `KINDE_POST_LOGIN_REDIRECT_URL` | ✅ to sign in | Usually `<app>/dashboard`. |
| `KINDE_POST_LOGOUT_REDIRECT_URL` | ✅ to sign in | Usually `<app>/`. |
| `BILLING_PROVIDER` | ⬜ | `stripe` or `mock`. Inferred from `STRIPE_SECRET_KEY` when unset. |
| `STRIPE_SECRET_KEY` | ⬜ | `sk_test_...`; required when billing is `stripe`. |
| `STRIPE_WEBHOOK_SECRET` | ⬜ | `whsec_...` for `/api/webhook/stripe`. |
| `STRIPE_PRICE_ID` | ⬜ | Recurring price for the Pro plan. |
| `NEXT_PUBLIC_APP_URL` | ⬜ | Canonical URL; defaults to the request host. |

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Development server. |
| `npm run build` | Production build. |
| `npm start` | Serve the build. |
| `npm run lint` | ESLint (`next lint`). |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm test` | Vitest integration suite. |
| `npm run db:migrate` | Create and apply a migration. |
| `npm run db:deploy` | Apply pending migrations in production. |
| `npm run db:seed` | Seed fixtures. |
| `npm run db:studio` | Prisma Studio. |

## Tests

The suite runs against a real PostgreSQL database (the same `.env` as the app)
and proves the rules a UI demo cannot:

- user B cannot read, update or delete user A's note;
- the free plan stops at 10 notes and Pro is unlimited;
- blank and oversized input is rejected and text is trimmed.

```bash
npm test
```

CI (`.github/workflows/ci.yml`) spins up Postgres 17, applies migrations and runs
typecheck, tests and the build.

## Routes

| Route | Access | Description |
| --- | --- | --- |
| `/` | Public | Landing; signed-in users go to the dashboard. |
| `/dashboard` | Private | Notes list with plan usage. |
| `/dashboard/new` | Private | Create a note (blocked at the free limit). |
| `/dashboard/notes/[id]` | Private | Edit a note you own. |
| `/dashboard/billing` | Private | Plans and subscription management. |
| `/dashboard/settings` | Private | Name and colour scheme. |
| `/api/auth/[kindeAuth]` | Public | Kinde auth handler. |
| `/api/webhook/stripe` | Stripe | Signature-verified webhook. |

## Deployment

1. Import the repo into Vercel (or any Node host).
2. Add the environment variables above; set `BILLING_PROVIDER="stripe"` and the
   Stripe keys for real payments.
3. Run `npm run db:deploy` against the production database.
4. Point a Stripe webhook at `https://<domain>/api/webhook/stripe` and subscribe
   to `checkout.session.completed` and `invoice.payment_succeeded`.

## Roadmap

- **Now** — foundations: authorisation, plan enforcement, migrations, tests, CI.
- **Next** — markdown editor with autosave, tags, full-text search, favourites
  and trash with restore.
- **Then** — AI summaries and auto-tagging (pluggable provider with an offline
  fallback), public share links and Markdown export.
- **Later** — team knowledge base: code snippets with syntax highlighting,
  language-aware search and collections.

## License

All rights reserved. Add a `LICENSE` file if you intend to open-source it.
