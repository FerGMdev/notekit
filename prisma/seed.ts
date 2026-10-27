import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FREE_USER_ID = "seed-user-free";
const PRO_USER_ID = "seed-user-pro";

const now = Math.floor(Date.now() / 1000);
const THIRTY_DAYS = 30 * 24 * 60 * 60;

/** Markdown content so the editor has something realistic to render. */
const freeUserNotes = [
  {
    title: "Weekly sync — product decisions",
    description: `# Weekly sync

**Attendees:** Ana, Luis, Priya

## Decisions

- Ship the search feature behind a flag on Thursday.
- Drop the "collections" idea for now; tags already cover the use case.
- Move the pricing review to next sprint.

## Action items

- [ ] Ana: draft the release notes
- [ ] Luis: measure activation after launch
- [x] Priya: update the onboarding copy`,
  },
  {
    title: "Deploy runbook",
    description: `# Deploy runbook

1. Run \`npm run build\` locally and fix any type error.
2. Push to \`main\` — CI runs lint, tests and the build.
3. Apply migrations **before** the new version starts:

\`\`\`bash
npx prisma migrate deploy
\`\`\`

4. Smoke test: sign in, create a note, edit it, delete it.
5. If something breaks, roll back from the Vercel dashboard.

> Never run \`migrate dev\` against production.`,
  },
  {
    title: "Reading list",
    description: `# Reading list

- [ ] *Designing Data-Intensive Applications* — Kleppmann
- [ ] *Refactoring UI* — Wathan & Schoger
- [x] *The Pragmatic Programmer*
- [ ] Postgres full-text search: a practical guide
- [ ] Stripe Billing: how proration actually works`,
  },
  {
    title: "API design principles",
    description: `# API design principles

- Validate every input at the boundary. Types are not validation.
- Return the smallest useful payload.
- Authorisation is checked **on the server**, next to the data access — never inferred from the UI.
- Prefer explicit errors over silent fallbacks.
- Version anything a client can depend on.`,
  },
  {
    title: "Interview notes — backend candidate",
    description: `# Interview notes

**Role:** Backend engineer (mid-level)

## Strong signals

- Explained the difference between authentication and authorisation without prompting.
- Chose \`upsert\` for the webhook handler and justified it with idempotency.
- Asked good questions about on-call.

## Concerns

- Limited experience with database migrations in production.

**Verdict:** advance to the system design round.`,
  },
  {
    title: "Trip planning — Oaxaca",
    description: `# Oaxaca, 4 days

## Day 1
- Arrive, walk the Zócalo, dinner at a market stall.

## Day 2
- Monte Albán in the morning (go early, it gets hot).
- Mezcal tasting in the afternoon.

## Day 3
- Hierve el Agua + Teotitlán textile workshops.

## Day 4
- Mercado 20 de Noviembre, then fly back.

**Budget:** ~$450 including flights.`,
  },
  {
    title: "Fetch with timeout",
    description: `\`\`\`typescript
export async function fetchWithTimeout(
  url: string,
  timeoutMs = 5_000
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
\`\`\`

Abort long requests instead of hoping the network behaves.`,
    kind: "SNIPPET" as const,
    language: "typescript",
  },
];

const proUserNotes = [
  {
    title: "Q3 retro",
    description: `# Q3 retro

## What went well
- Cut the release cycle from two weeks to three days.
- Test coverage on the billing module went from 0% to 68%.

## What didn't
- Two incidents caused by missing ownership checks on mutations.

## Try next
- Every mutation gets a test that proves user B cannot touch user A's data.`,
  },
  {
    title: "Pricing experiments",
    description: `# Pricing experiments

Hypothesis: a free tier with a hard limit converts better than a trial.

| Plan | Price | Limit |
| --- | --- | --- |
| Free | $0 | 10 items |
| Pro | $8/mo | Unlimited |

Measure: 7-day activation and free→pro conversion.`,
  },
];

/** Tags and favourites keep the demo data looking like a used product. */
const noteMeta: Record<string, { tags: string[]; isFavorite?: boolean }> = {
  "Weekly sync — product decisions": { tags: ["product", "meetings"] },
  "Deploy runbook": { tags: ["engineering", "ops"], isFavorite: true },
  "Reading list": { tags: ["reading"] },
  "API design principles": { tags: ["engineering", "architecture"] },
  "Interview notes — backend candidate": { tags: ["hiring"] },
  "Trip planning — Oaxaca": { tags: ["personal", "travel"] },
  "Fetch with timeout": { tags: ["engineering", "typescript"], isFavorite: true },
  "Q3 retro": { tags: ["engineering", "process"], isFavorite: true },
  "Pricing experiments": { tags: ["product", "pricing"] },
};

async function seedUser(id: string, email: string, name: string) {
  return prisma.user.upsert({
    where: { id },
    update: { email, name },
    create: { id, email, name },
  });
}

async function main() {
  const freeUser = await seedUser(FREE_USER_ID, "free@example.com", "Free User");
  const proUser = await seedUser(PRO_USER_ID, "pro@example.com", "Pro User");

  await prisma.collection.deleteMany({
    where: { userId: { in: [freeUser.id, proUser.id] } },
  });

  await prisma.note.deleteMany({
    where: { userId: { in: [freeUser.id, proUser.id] } },
  });

  await prisma.note.createMany({
    data: freeUserNotes.map((note) => ({
      ...note,
      userId: freeUser.id,
      tags: noteMeta[note.title]?.tags ?? [],
      isFavorite: noteMeta[note.title]?.isFavorite ?? false,
    })),
  });

  const handbook = await prisma.collection.create({
    data: {
      userId: freeUser.id,
      name: "Engineering handbook",
      description: "How we build, review and ship.",
    },
    select: { id: true },
  });

  await prisma.note.updateMany({
    where: { userId: freeUser.id, tags: { has: "engineering" } },
    data: { collectionId: handbook.id },
  });

  await prisma.note.createMany({
    data: proUserNotes.map((note) => ({
      ...note,
      userId: proUser.id,
      tags: noteMeta[note.title]?.tags ?? [],
      isFavorite: noteMeta[note.title]?.isFavorite ?? false,
    })),
  });

  await prisma.subscription.upsert({
    where: { userId: proUser.id },
    update: { status: "active" },
    create: {
      userId: proUser.id,
      stripeSubscriptionId: "sub_seed_pro",
      status: "active",
      planId: "price_seed_pro",
      interval: "month",
      currentPeriodStart: now,
      currentPeriodEnd: now + THIRTY_DAYS,
    },
  });

  const [users, notes] = await Promise.all([
    prisma.user.count(),
    prisma.note.count(),
  ]);

  console.log(`Seed complete: ${users} users, ${notes} notes.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
