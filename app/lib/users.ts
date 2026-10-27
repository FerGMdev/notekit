import prisma from "./db";
import type { SessionUser } from "./auth";
import { ensureStripeCustomer } from "./billing";
import { isDevAuth } from "./env";

const WELCOME_NOTE = {
  title: "Welcome — start here",
  description: `# Welcome

This is your first note. A few things you can do:

- **Edit** it with the pencil icon, or move it to trash once you are done.
- Save reusable code as a **snippet** from the Snippets tab.
- Group notes and snippets into a **collection** to keep a handbook in one place.
- Add **tags** and mark items as favourites to find them faster.
- Switch the colour scheme from **Settings**.

## Markdown works

Headings, **bold**, *italic*, \`inline code\`, tables and lists all render.

\`\`\`bash
npm run dev
\`\`\`

> Tip: your notes are private. Nobody else can read or modify them.`,
  tags: ["welcome"],
  isFavorite: false,
};

/**
 * Demo mode should look like a used product, not an empty database: a few
 * notes with tags, a favourite and Markdown worth switching to Preview for.
 * These are created once for the local demo user only.
 */
const DEV_DEMO_NOTES = [
  {
    title: "Deploy runbook",
    description: `# Deploy runbook

1. Merge to \`main\`; CI runs typecheck, tests and a production build.
2. Apply migrations: \`npm run db:deploy\`.
3. Deploy, then check \`/api/health\` and the error dashboard.

\`\`\`bash
npm run db:deploy
npm run build
\`\`\`

> Roll back by redeploying the previous build. Migrations are additive.`,
    tags: ["engineering", "ops"],
    isFavorite: true,
  },
  {
    title: "How we review code",
    description: `# How we review code

- Keep the diff small enough to read in one sitting.
- A review is about the code, never the author.
- Every bug fix gets a test that fails before the fix.

## Checklist

| Check | Why |
| --- | --- |
| Ownership checks | Prevent IDOR |
| Input validation | Untrusted data stays at the boundary |
| Error states | Users should know what happened |`,
    tags: ["engineering", "process"],
    isFavorite: false,
  },
  {
    title: "Debounce a function",
    description: `\`\`\`typescript
export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  wait = 250
) {
  let timer: ReturnType<typeof setTimeout> | undefined;

  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
\`\`\`

Use it for search inputs: keep the UI responsive and fire the request once
the user pauses. The language field powers the filter and highlighting.`,
    tags: ["engineering", "typescript", "frontend"],
    isFavorite: true,
    kind: "SNIPPET" as const,
    language: "typescript",
  },
  {
    title: "Reading list",
    description: `# Reading list

- *A Philosophy of Software Design* — deep modules, narrow interfaces.
- *Designing Data-Intensive Applications* — chapters 5–7 on replication.
- The Postgres docs on [indexes](https://www.postgresql.org/docs/current/indexes.html).`,
    tags: ["reading"],
    isFavorite: false,
  },
  {
    title: "Product ideas parking lot",
    description: `# Parking lot

- Public share links with a readable slug.
- Weekly digest email of notes you have not opened.
- Snippets collection for the team wiki.`,
    tags: ["product", "ideas"],
    isFavorite: false,
  },
];

/**
 * Mirrors the identity provider user into our database and makes sure a
 * billing customer exists. Runs on every dashboard render, so it must stay
 * cheap after the first call.
 */
export async function ensureUser(user: SessionUser) {
  const existing = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, name: true, stripeCustomerId: true },
  });

  if (!existing) {
    await prisma.user.create({
      data: {
        id: user.id,
        email: user.email || null,
        name: user.name,
      },
    });

    // Give every new account something to read instead of an empty screen.
    await prisma.note.createMany({
      data: (isDevAuth ? [WELCOME_NOTE, ...DEV_DEMO_NOTES] : [WELCOME_NOTE]).map(
        (note) => ({ ...note, userId: user.id })
      ),
    });

    if (isDevAuth) {
      const collection = await prisma.collection.create({
        data: {
          userId: user.id,
          name: "Engineering handbook",
          description: "How we build, review and ship.",
        },
        select: { id: true },
      });

      // The demo should teach the feature without a second click.
      await prisma.note.updateMany({
        where: { userId: user.id, tags: { has: "engineering" } },
        data: { collectionId: collection.id },
      });
    }

    await ensureStripeCustomer({ userId: user.id, email: user.email });
    return;
  }

  // Profile data can change in the identity provider.
  if (existing.email !== user.email || existing.name !== user.name) {
    await prisma.user.update({
      where: { id: user.id },
      data: { email: user.email || null, name: user.name },
    });
  }

  if (!existing.stripeCustomerId) {
    await ensureStripeCustomer({ userId: user.id, email: user.email });
  }
}
