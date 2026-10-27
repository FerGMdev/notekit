# Notekit

A notes app built as a real product, not a tutorial: private notes, reusable
snippets, a free plan that is enforced on the server, and a codebase you can
reason about.

> **Status:** a working product. Writing, organising, finding, summarising,
> sharing and exporting work end to end for both notes and snippets. The team
> knowledge base — language-aware snippet search and collections — is in place.
> Foundations — authorisation, validation, migrations, tests and CI — are solid.
> What is left is polish: onboarding, screenshots and end-to-end tests.

---

## What it does today

- **Write in Markdown** with a preview tab, word count and **autosave** (a
  debounced server action; a `Cmd/Ctrl+S`-style "Save now" if you prefer).
- **Save snippets** — pick a language, paste code and get syntax highlighting in
  the editor, share page and every read-only surface. Snippets get the same
  tags, search, favourites, trash, sharing, export and AI as notes.
- **Find snippets by language** — a curated language filter that only shows
  languages you actually use, plus full-text search across titles and code.
- **Group with collections** — lightweight folders for a handbook or onboarding
  guide. Collections organise items; they are not a permission boundary.
- **Organise with tags** — lowercase, deduplicated, max 8 per item, filterable
  from the library.
- **Find things fast** — search across title and content (case-insensitive),
  filter by tag, language or favourites, and sort by last updated, newest or
  title.
- **Favourites** for the notes and snippets you keep coming back to.
- **Trash with restore** — trashed items disappear from search and from your
  plan usage, and can be restored or deleted forever.
- **AI summaries and tag suggestions** cached on the item, applied only when you
  click, and labelled when they may be out of date.
- **Ask your library** — natural-language questions answered from your own notes
  and snippets, with links back to the sources.
- **Public share links** — one item, read-only, revocable at any time, and dead
  the moment it is trashed. Search engines are told not to index them.
- **Markdown export** — download a single item or your whole library with YAML
  frontmatter (including `kind` and `language`), ready for Obsidian, VS Code or
  a static site.
- **Authentication** with Kinde, plus a **local demo mode** (`AUTH_PROVIDER=dev`)
  so the app runs without an identity provider — rejected in production.
- **CRUD scoped to the signed-in account**, with server-side ownership checks on
  every read and write.
- **Free plan with a real limit** — 10 items (notes and snippets together) — plus
  a Pro plan for unlimited items. The limit is enforced in the domain layer, not
  by hiding buttons.
- **Stripe billing** — Checkout, Customer Portal and signed webhooks, with a
  `mock` provider so the app is fully usable without Stripe keys.
- **Per-user theming** — light/dark plus seven accent schemes.
- **Failure UX** — error boundaries, a real 404 page, loading skeletons and
  accessible form feedback.

### One pipeline for notes and snippets

A snippet is a note with `kind = SNIPPET`, an optional `language` and a body
whose first fenced code block is the code. That is a deliberate architectural
choice: search, tags, favourites, trash, sharing, export and AI already had a
correct, tested pipeline. A second entity would have meant a second version of
all of it, and two places to fix every bug.

```ts
// Creating a snippet is still creating a note.
const snippet = await createNote(user.id, {
  title: "Debounce",
  description: buildSnippetMarkdown({ code, language: "typescript" }),
  kind: "SNIPPET",
  language: "typescript",
});
```

Collections are a nullable foreign key (`onDelete: SetNull`), so deleting a
folder never deletes the knowledge inside it.

### AI that works without a key

`app/lib/ai` is written against one small interface. The default provider is a
deterministic, offline heuristic: an extractive summariser, a keyword tagger and
a retrieval scorer over your library. It needs no account, sends nothing anywhere
and is covered by the test suite. Set `AI_API_KEY` and the same features use any
OpenAI-compatible endpoint instead — OpenAI, Groq, OpenRouter, a local Ollama
server or an AI gateway — with the heuristic as the fallback if a request fails.

## Architecture

```
app/
├── dashboard/              # Auth-gated area (force-dynamic)
│   ├── (lists)/            # Library views sharing one loading skeleton
│   │   ├── page.tsx        # Notes: search, tags, favourites, sorting
│   │   ├── snippets/       # Snippets: language filter + new snippet form
│   │   ├── collections/    # Collections list and collection detail
│   │   ├── ask/            # Ask your library
│   │   └── trash/          # Restore or delete forever
│   ├── notes/[id]/         # Markdown/snippet editor, AI panel, sharing
│   │   └── export/         # Per-item Markdown download
│   ├── new/                # Create a note
│   ├── billing/            # Plans + subscription management
│   ├── settings/           # Profile + colour scheme
│   ├── export/             # Whole-library Markdown download
│   ├── list-actions.ts     # Favourite/trash mutations shared by lists
│   ├── collections-actions.ts
│   └── layout.tsx          # Session guard + user sync
├── components/
│   ├── LibraryView.tsx     # One browser for notes and snippets
│   └── NoteCard.tsx        # Card with snippet badge and copy button
├── share/[shareId]/        # Public, read-only, noindex
├── lib/
│   ├── auth.ts             # The only place that knows about the identity provider
│   ├── session.ts          # Request-scoped signed-in user (mirrored + cached)
│   ├── notes.ts            # Domain layer: ownership, filters, collections, plan
│   ├── languages.ts        # Curated language ids, code fences, extraction
│   ├── sharing.ts          # Create/revoke share tokens, public read
│   ├── export.ts           # Markdown serialisation with YAML frontmatter
│   ├── ai/                 # Provider interface, heuristic, OpenAI adapter, quota
│   ├── billing.ts          # Stripe or mock, chosen by config
│   ├── users.ts            # User mirroring, welcome note and demo fixtures
│   ├── env.ts              # Validated, typed environment
│   ├── url.ts              # Absolute URLs for redirects and share links
│   └── db.ts               # Prisma singleton
├── api/webhook/stripe/     # Signature-verified webhook
└── page.tsx                # Landing
```

### Nine decisions worth explaining

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

**6. AI is an interface with a real offline implementation.**
`AiProvider` has three methods (`summarize`, `suggestTags`, `answer`) and two
implementations chosen by configuration. The heuristic provider is the default:
it runs on the server, costs nothing, is deterministic and is tested. The OpenAI
adapter swaps in with `AI_API_KEY`; if it times out, errors or returns
unparseable JSON, the service falls back to the heuristic and the UI shows which
provider answered. Contrast that with the usual "AI feature that breaks without
a key" — the demo never depends on a vendor account.

**7. Sharing is a capability, not a boolean.**
A note is shared by storing a random 16-character token in `Note.shareId`; the
public page resolves on token **and** `deletedAt IS NULL`, so trashing an item
kills its link instantly. Revoking sets the token to `null`. Tokens are
`noindex`, revocable, and never expose the owner or other notes. External AI
calls are capped per user per day with a single atomic SQL upsert (`AiUsage`),
because a cost control that races is not a cost control.

**8. Snippets are notes with a language, not a parallel universe.**
`Note.kind` and `Note.language` add the minimum metadata needed for a code
library, while search, tags, favourites, trash, share links, export and AI all
keep working unchanged. Snippet bodies remain canonical Markdown: a fenced code
block plus optional explanation. That means a snippet is readable in any
Markdown editor today, and the language picker only controls the filter, badge
and highlighter — not a proprietary storage format.

**9. Collections organise; they do not authorise.**
A collection is a nullable foreign key with `onDelete: SetNull`. Assigning an
item validates that the collection belongs to the signed-in account in a second
query, so a valid UUID from another account is rejected rather than silently
attached. Deleting a collection detaches its items and keeps every note and
snippet. The dashboard still filters each item by `userId` first; a collection
is a view, never a security boundary.

## Security model

| Risk | Mitigation |
| --- | --- |
| IDOR on notes, snippets, collections | Every query filters by `userId`; cross-account access is a 404. |
| Paywall bypass | The free-plan limit is checked inside `createNote`, counting notes and snippets; not in JSX. |
| Untrusted input | Zod schemas at the boundary (`title` ≤ 120 chars, content ≤ 50k, language allow-list). |
| Foreign collection id | `setNoteCollection` re-checks collection ownership before the write. |
| Stored XSS | Markdown renders without raw HTML; fenced code is escaped by the highlighter. |
| Forged webhooks | Stripe signature verification is mandatory; the route is 503 without a secret. |
| Misconfiguration | `app/lib/env.ts` validates the environment once and fails loudly. |
| Demo auth in production | `AUTH_PROVIDER=dev` throws on every request when `NODE_ENV=production`. |
| Privilege escalation | Dashboard routes are auth-gated server-side; actions re-read the session. |
| Leaked share link | Random 16-char token, revocable, dead when the item is trashed, `noindex`. |
| Runaway AI cost | External calls are capped per user per day by an atomic upsert; the heuristic is free. |

## Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 15 (App Router, Server Components, Server Actions) |
| Language | TypeScript (strict) |
| Database | PostgreSQL (Neon-compatible) + Prisma |
| Auth | Kinde (or built-in demo mode) |
| AI | Built-in heuristic, or any OpenAI-compatible API |
| Payments | Stripe (optional) |
| UI | Tailwind CSS + shadcn/ui (Radix) |
| Markdown | react-markdown + remark-gfm + rehype-highlight |
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
AI is optional: with no key the built-in heuristic provider powers summaries,
tags and questions.

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
| `AI_PROVIDER` | ⬜ | `auto` (default), `heuristic` or `openai`. `auto` uses the key when present. |
| `AI_API_KEY` | ⬜ | Enables the OpenAI-compatible provider. Leave empty for the offline heuristic. |
| `AI_BASE_URL` | ⬜ | Defaults to `https://api.openai.com/v1`; point it at Groq, OpenRouter, Ollama, etc. |
| `AI_MODEL` | ⬜ | Defaults to `gpt-4o-mini`. |
| `AI_DAILY_LIMIT` | ⬜ | External AI requests per user per day. Defaults to `50`. |
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
| `npm run demo:reset` | Delete the local demo user; the next dashboard visit recreates it with demo notes, a snippet and a collection. |

## Tests

The suite runs against a real PostgreSQL database (the same `.env` as the app)
and proves the rules a UI demo cannot:

- user B cannot read, update or delete user A's note;
- the free plan stops at 10 items and Pro is unlimited; snippets count too;
- blank and oversized input is rejected and text is trimmed;
- search matches title and content case-insensitively, including snippet code,
  and tag/language filters are exact;
- a snippet never appears in the notes list, stores its language canonically and
  is found by the language filter;
- collections reject case-insensitive duplicate names, cannot be read or deleted
  by another account, and detach their items when deleted;
- a collection id from another account cannot be attached to your item;
- trashed items vanish from lists, search and plan usage until restored;
- favourites toggle and filter correctly;
- the heuristic summariser is deterministic and bounded, tags skip stopwords and
  existing tags, and retrieval cites the right item;
- an OpenAI adapter parses JSON tags, falls back to heuristics on nonsense and
  throws on HTTP errors so the service can degrade;
- share links resolve publicly, are idempotent, and stop resolving on revoke,
  trash, or when another account tries to create or revoke them;
- Markdown export produces parseable frontmatter (including `kind`/`language`)
  and safe filenames.

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
| `/dashboard/snippets` | Private | Snippet library: language filter, copy-to-clipboard. |
| `/dashboard/snippets/new` | Private | Create a snippet (blocked at the free limit). |
| `/dashboard/collections` | Private | Collections list and create form. |
| `/dashboard/collections/[id]` | Private | Items in one collection. |
| `/dashboard/ask` | Private | Ask your library; answers cite the source items. |
| `/dashboard/new` | Private | Create a note (blocked at the free limit). |
| `/dashboard/notes/[id]` | Private | Editor for a note or snippet, autosave, AI, sharing. |
| `/dashboard/notes/[id]/export` | Private | Download one item as Markdown. |
| `/dashboard/export` | Private | Download every item as one Markdown file. |
| `/dashboard/trash` | Private | Restore or permanently delete trashed items. |
| `/dashboard/billing` | Private | Plans and subscription management. |
| `/dashboard/settings` | Private | Name and colour scheme. |
| `/share/[shareId]` | Public link | Read-only note or snippet, `noindex`, revocable. |
| `/api/auth/[kindeAuth]` | Public | Kinde auth handler. |
| `/api/webhook/stripe` | Stripe | Signature-verified webhook. |

## Deployment

1. Import the repo into Vercel (or any Node host).
2. Add the environment variables above; set `BILLING_PROVIDER="stripe"` and the
   Stripe keys for real payments. Set `AI_API_KEY` only if you want model-backed
   AI — the heuristic works anywhere.
3. Run `npm run db:deploy` against the production database.
4. Point a Stripe webhook at `https://<domain>/api/webhook/stripe` and subscribe
   to `checkout.session.completed` and `invoice.payment_succeeded`.

## Roadmap

- **Done** — foundations: authorisation, plan enforcement, migrations, tests, CI.
- **Done** — markdown editor with autosave, tags, search, favourites and trash
  with restore.
- **Done** — AI summaries, auto-tagging and ask-your-notes with a pluggable
  provider and an offline fallback; revocable public share links; Markdown export.
- **Done** — team knowledge base: snippets with syntax highlighting,
  language-aware search, collections, and one shared library pipeline.
- **Next** — onboarding, screenshots and end-to-end tests for the critical flows.

## License

All rights reserved. Add a `LICENSE` file if you intend to open-source it.
