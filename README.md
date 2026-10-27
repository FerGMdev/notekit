# Notekit

A notes app built as a real product, not a tutorial: private notes, a free plan
that is enforced on the server, and a codebase you can reason about.

> **Status:** usable product, still growing. Writing, organising and finding
> notes works end to end; AI assistance, sharing and the team knowledge base
> are next. Foundations — authorisation, validation, migrations, tests and CI —
> are in place.

---

## What it does today

- **Write in Markdown** with a preview tab, word count and **autosave** (a
  debounced server action; `Cmd/Ctrl+S`-style "Save now" if you prefer).
- **Organise with tags** — lowercase, deduplicated, max 8 per note, filterable
  from the dashboard.
- **Find notes fast** — search across title and content (case-insensitive),
  filter by tag or favourites, and sort by last updated, newest or title.
- **Favourites** for the notes you keep coming back to.
- **Trash with restore** — trashed notes disappear from search and from your
  plan usage, and can be restored or deleted forever.
- **Authentication** with Kinde, plus a **local demo mode** (`AUTH_PROVIDER=dev`)
  so the app runs without an identity provider — rejected in production.
- **Notes CRUD** scoped to the signed-in account, with server-side ownership
  checks on every read and write.
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
│   ├── (lists)/            # Dashboard + trash, sharing a loading skeleton
│   │   ├── page.tsx        # Search, tags, favourites, sorting
│   │   └── trash/          # Restore or delete forever
│   ├── notes/[id]/         # Markdown editor with autosave
│   ├── new/                # Create a note
│   ├── billing/            # Plans + subscription management
│   ├── settings/           # Profile + colour scheme
│   └── layout.tsx          # Session guard + user sync
├── lib/
│   ├── auth.ts             # The only place that knows about the identity provider
│   ├── session.ts          # Request-scoped signed-in user (mirrored + cached)
│   ├── notes.ts            # Note domain layer (ownership, filters, trash, plan rules)
│   ├── billing.ts          # Stripe or mock, chosen by config
│   ├── users.ts            # User mirroring, welcome note and demo fixtures
│   ├── env.ts              # Validated, typed environment
│   ├── url.ts              # Absolute URLs for redirects
│   └── db.ts               # Prisma singleton
├── api/webhook/stripe/     # Signature-verified webhook
└── page.tsx                # Landing
```

### Five decisions worth explaining

**1. Authorisation lives next to the data, not in the UI.**
`app/lib/notes.ts` takes a `userId` on every function and filters by it inside
the query (`where: { id, userId }`). Calling
`deleteNotePermanently(user.id, noteId)` with another account's note deletes
zero rows and throws `NoteNotFoundError`. A missing note and someone else's note
are deliberately indistinguishable.

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

**4. Search is honest about its current scale.**
Search uses parameterised `ILIKE` (`contains` + `insensitive`) across title and
content: correct, injection-safe and enough for a personal corpus. The migration
path is a `tsvector` column with a GIN index — worth doing when a single account
has tens of thousands of notes, not before, because generated columns are not
representable in `schema.prisma` and would create migration drift today.

**5. Autosave is a debounced server action, not a second API.**
The editor is a client component because typing is client state; saving goes
through `autosaveNote`, which re-validates with the same Zod schema as the HTTP
boundary and re-reads the session. The client cannot skip ownership checks, and
a failed save is visible in the UI instead of silently lost.

## Security model

| Risk | Mitigation |
| --- | --- |
| IDOR on notes | Every query filters by `userId`; cross-account access is a 404. |
| Paywall bypass | The free-plan limit is checked inside `createNote`, not in JSX. |
| Untrusted input | Zod schemas at the boundary (`title` ≤ 120 chars, `content` ≤ 50k). |
| Forged webhooks | Stripe signature verification is mandatory; the route is 503 without a secret. |
| Misconfiguration | `app/lib/env.ts` validates the environment once and fails loudly. |
| Demo auth in production | `AUTH_PROVIDER=dev` throws on every request when `NODE_ENV=production`. |
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
`BILLING_PROVIDER="mock"` to skip Stripe entirely, and leave
`AUTH_PROVIDER="dev"` to explore the app as a local demo user without signing up.
Switch to `AUTH_PROVIDER="kinde"` (plus the Kinde variables) for real accounts.

### 3. Create the schema

```bash
npx prisma migrate deploy   # apply committed migrations
npm run db:seed             # optional fixtures
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). In demo mode the landing
page links straight into the dashboard as `Demo User`; no account is needed.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Pooled PostgreSQL URL used at runtime. |
| `DIRECT_URL` | ✅ | Direct URL used by Prisma Migrate. |
| `AUTH_PROVIDER` | ⬜ | `kinde` for real logins, `dev` for the local demo user. Defaults to `kinde` when Kinde is configured, otherwise `dev`. `dev` is rejected in production. |
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
| `npm run demo:reset` | Delete the local demo user; the next dashboard visit recreates it with demo notes. |

## Tests

The suite runs against a real PostgreSQL database (the same `.env` as the app)
and proves the rules a UI demo cannot:

- user B cannot read, update or delete user A's note;
- the free plan stops at 10 notes and Pro is unlimited;
- blank and oversized input is rejected and text is trimmed;
- search matches title and content case-insensitively, and tag filters are exact;
- trashed notes vanish from lists, search and plan usage until restored;
- favourites toggle and filter correctly.

```bash
npm test
```

CI (`.github/workflows/ci.yml`) spins up Postgres 17, applies migrations and runs
typecheck, lint, tests and the build.

## Routes

| Route | Access | Description |
| --- | --- | --- |
| `/` | Public | Landing; signed-in users go to the dashboard (except in demo mode). |
| `/dashboard` | Private | Notes list: search, tags, favourites, sorting, plan usage. |
| `/dashboard/new` | Private | Create a note (blocked at the free limit). |
| `/dashboard/notes/[id]` | Private | Markdown editor with autosave. |
| `/dashboard/trash` | Private | Restore or permanently delete trashed notes. |
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

- **Done** — foundations: authorisation, plan enforcement, migrations, tests, CI.
- **Done** — markdown editor with autosave, tags, search, favourites and trash
  with restore.
- **Next** — AI summaries and auto-tagging (pluggable provider with an offline
  heuristic fallback), public share links and Markdown export.
- **Later** — team knowledge base: code snippets with syntax highlighting,
  language-aware search and collections.

## License

All rights reserved. Add a `LICENSE` file if you intend to open-source it.
