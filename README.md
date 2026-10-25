# NoteSaaS

A full-stack notes SaaS built with **Next.js 15 (App Router)**, **Prisma**, **PostgreSQL**, **Kinde** for authentication and **Stripe** for subscription billing.

Users sign in with Kinde, create, edit and delete notes, and unlock note creation with an active Stripe subscription. Everything runs server-side through React Server Components and Server Actions, with no separate API layer.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Stripe setup](#stripe-setup)
- [Available scripts](#available-scripts)
- [Routes](#routes)
- [Deployment](#deployment)
- [Known limitations](#known-limitations)
- [License](#license)

---

## Features

- **Authentication with Kinde** — sign up, sign in, log out and session handling out of the box.
- **Notes CRUD** — create, list, edit and delete notes, scoped to the signed-in user.
- **Subscription paywall** — creating notes requires an active Stripe subscription.
- **Stripe Checkout** — hosted checkout session for the monthly plan.
- **Stripe Customer Portal** — users can change or cancel their plan on their own.
- **Stripe webhooks** — subscription state is synced to the database.
- **Server Actions + `revalidatePath`** — mutations refresh the UI without client-side data fetching.
- **Theming** — light/dark mode plus 7 accent color schemes persisted per user, in the database.
- **UI** — Tailwind CSS + shadcn/ui components, responsive layout, accessible primitives from Radix UI.

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | [Next.js 15](https://nextjs.org/) (App Router, Server Components, Server Actions) |
| Language | [TypeScript](https://www.typescriptlang.org/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) (Radix UI) |
| Auth | [Kinde](https://kinde.com/) (`@kinde-oss/kinde-auth-nextjs`) |
| Database | PostgreSQL |
| ORM | [Prisma](https://www.prisma.io/) |
| Payments | [Stripe](https://stripe.com/) (Checkout, Billing Portal, Webhooks) |
| Icons | [lucide-react](https://lucide.dev/) |
| Theming | [next-themes](https://github.com/pacocoursey/next-themes) |

## Project structure

```
.
├── app/
│   ├── api/
│   │   ├── auth/[kindeAuth]/route.ts   # Kinde auth handler
│   │   └── webhook/stripe/route.ts     # Stripe webhook endpoint
│   ├── components/                     # App-level components (Navbar, UserNav, ...)
│   ├── dashboard/
│   │   ├── billing/page.tsx            # Upgrade + manage subscription
│   │   ├── new/[id]/page.tsx           # Edit a note
│   │   ├── new/page.tsx                # Create a note
│   │   ├── settings/page.tsx           # Profile + color scheme
│   │   ├── layout.tsx                  # Auth guard + user sync
│   │   └── page.tsx                    # Notes list
│   ├── lib/db.ts                       # Prisma client singleton
│   ├── payment/
│   │   ├── cancelled/page.tsx          # Checkout cancelled
│   │   └── success/page.tsx            # Checkout success
│   ├── layout.tsx                      # Root layout (fonts, theme, navbar)
│   ├── globals.css                     # Tailwind + theme tokens
│   └── page.tsx                        # Landing page
├── components/ui/                      # shadcn/ui primitives
├── lib/
│   ├── stripe.ts                       # Stripe client + checkout session helper
│   └── utils.ts                        # cn() helper
├── prisma/schema.prisma                # User, Subscription, Note models
└── public/                             # Static assets
```

## Getting started

### Prerequisites

- **Node.js 18.18+** (Node 20 LTS recommended)
- **npm** (or pnpm/yarn — a lockfile for npm is included)
- A **PostgreSQL** database ([Neon](https://neon.tech/), [Supabase](https://supabase.com/), or local)
- A **Kinde** account and application
- A **Stripe** account (test mode is fine for local development)

### 1. Clone and install

```bash
git clone https://github.com/FerGMdev/my-note-saas-app.git
cd my-note-saas-app
npm install
```

`npm install` also runs `prisma generate` via the `postinstall` script.

### 2. Configure environment variables

```bash
cp .env.example .env
```

Then fill in the values — see [Environment variables](#environment-variables).

### 3. Create the database schema

```bash
npx prisma migrate dev --name init
```

For a quick first run without migration history you can use `npx prisma db push`.

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> The dashboard layout creates the user row and the Stripe customer on first visit, so sign in once to seed your account.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Pooled PostgreSQL connection string (used by the app at runtime). |
| `DIRECT_URL` | ✅ | Direct PostgreSQL connection string (used by Prisma Migrate). |
| `KINDE_CLIENT_ID` | ✅ | Kinde application client ID. |
| `KINDE_CLIENT_SECRET` | ✅ | Kinde application client secret. |
| `KINDE_ISSUER_URL` | ✅ | Your Kinde domain, e.g. `https://your-app.kinde.com`. |
| `KINDE_SITE_URL` | ✅ | Public URL of the app (`http://localhost:3000` in development). |
| `KINDE_POST_LOGIN_REDIRECT_URL` | ✅ | Where to land after login, e.g. `http://localhost:3000/dashboard`. |
| `KINDE_POST_LOGOUT_REDIRECT_URL` | ✅ | Where to land after logout, e.g. `http://localhost:3000`. |
| `STRIPE_SECRET_KEY` | ✅ | Stripe secret key (`sk_test_...`). |
| `STRIPE_WEBHOOK_SECRET` | ✅ | Signing secret of the webhook endpoint (`whsec_...`). |
| `STRIPE_PRICE_ID` | ✅ | Price ID of the subscription plan (`price_...`). |
| `NEXT_PUBLIC_APP_URL` | ⬜ | Public base URL used for Stripe redirects. Falls back to the request host when unset. |

Kinde's SDK reads its variables directly from the environment, so the names above must match exactly.

## Stripe setup

1. **Create a product and a recurring price** in the Stripe Dashboard (Test mode) and copy the price ID into `STRIPE_PRICE_ID`.
2. **Forward webhooks locally** with the [Stripe CLI](https://stripe.com/docs/stripe-cli):

   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/api/webhook/stripe
   ```

   Copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`.

3. **Subscribe to these events** (the CLI forwards all of them; in production select them in the Dashboard):

   - `checkout.session.completed`
   - `invoice.payment_succeeded`

4. **Enable the Customer Portal** in the Stripe Dashboard (*Settings → Billing → Customer portal*) so the "Edit subscription" flow works.

> Set `NEXT_PUBLIC_APP_URL` to your deployed domain in production so Stripe redirects back to the right host.

## Available scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the development server. |
| `npm run build` | Create a production build. |
| `npm start` | Serve the production build. |
| `npm run lint` | Run ESLint via `next lint`. |
| `postinstall` | Runs `prisma generate` automatically after installing dependencies. |

Useful Prisma commands:

```bash
npx prisma migrate dev      # Create + apply a migration in development
npx prisma migrate deploy   # Apply pending migrations in production
npx prisma studio          # Browse the database in a GUI
npx prisma generate        # Regenerate the client
```

## Routes

| Route | Access | Description |
| --- | --- | --- |
| `/` | Public | Landing page; redirects authenticated users to `/dashboard`. |
| `/dashboard` | Private | List of the user's notes. |
| `/dashboard/new` | Private + active subscription | Create a note. |
| `/dashboard/new/[id]` | Private | Edit an existing note. |
| `/dashboard/settings` | Private | Name and color scheme. |
| `/dashboard/billing` | Private | Upgrade or manage the subscription. |
| `/payment/success` | Private | Post-checkout success page. |
| `/payment/cancelled` | Private | Post-checkout cancellation page. |
| `/api/auth/[kindeAuth]` | Public | Kinde auth callback. |
| `/api/webhook/stripe` | Stripe | Subscription webhook handler. |

### Data model

- **User** — Kinde `id`, name, email, `stripeCustomerId`, `colorScheme`.
- **Subscription** — Stripe subscription ID, plan, status, billing interval and current period, one per user.
- **Note** — title, description, timestamps, optional owner.

## Deployment

The app is built for **Vercel** (or any Node.js host):

1. Push the repo and import it into Vercel.
2. Add every variable from [Environment variables](#environment-variables), using production values (`KINDE_SITE_URL` and redirect URLs must be the deployed domain).
3. Run `npx prisma migrate deploy` against the production database.
4. Create a production Stripe webhook pointing to `https://<your-domain>/api/webhook/stripe` and add its signing secret as `STRIPE_WEBHOOK_SECRET`.
5. Switch Stripe to live keys and a live price ID.

## Known limitations

Tracked honestly so contributions are welcome:

- **Metadata**: `app/layout.tsx` still ships the default "Create Next App" title and description.
- **Landing page copy**: the hero mentions "AI-powered note sorting", but no AI feature is implemented yet.
- **No tests or CI** configured.

## License

No license file is included yet. If you intend to open-source this project, add a `LICENSE` (MIT is a common choice) — otherwise all rights are reserved by default.
