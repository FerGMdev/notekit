import prisma from "./db";
import type { SessionUser } from "./auth";
import { ensureStripeCustomer, FREE_NOTE_LIMIT } from "./billing";

const WELCOME_NOTE = {
  title: "Welcome — start here",
  description: `# Welcome

This is your first note. A few things you can do:

- **Edit** it with the pencil icon, or delete it once you are done.
- Create as many notes as you need: the free plan allows ${FREE_NOTE_LIMIT}.
- Switch the colour scheme from **Settings**.

## Markdown works

Headings, **bold**, *italic*, \`inline code\` and lists all render.

\`\`\`bash
npm run dev
\`\`\`

> Tip: your notes are private. Nobody else can read or modify them.`,
};

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
    await prisma.note.create({
      data: { ...WELCOME_NOTE, userId: user.id },
    });

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
