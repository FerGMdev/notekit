import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import prisma from "@/app/lib/db";
import {
  countNotes,
  createNote,
  deleteNote,
  getNote,
  NoteLimitError,
  NoteNotFoundError,
  updateNote,
} from "@/app/lib/notes";
import {
  FREE_NOTE_LIMIT,
  isFreePlanLimitReached,
} from "@/app/lib/billing";

/**
 * Integration tests against a real Postgres database.
 *
 * The point is not to re-test Prisma: it is to prove the product rules that a
 * demo cannot show — that one account can never read, edit or delete another
 * account's note, and that the free plan is enforced on the server.
 */

const suffix = randomUUID();
const ownerId = `test-owner-${suffix}`;
const strangerId = `test-stranger-${suffix}`;
const freeUserId = `test-free-${suffix}`;
const proUserId = `test-pro-${suffix}`;

beforeAll(async () => {
  await prisma.user.createMany({
    data: [
      { id: ownerId, email: `${ownerId}@example.test`, name: "Owner" },
      { id: strangerId, email: `${strangerId}@example.test`, name: "Stranger" },
      { id: freeUserId, email: `${freeUserId}@example.test`, name: "Free" },
      { id: proUserId, email: `${proUserId}@example.test`, name: "Pro" },
    ],
  });
});

afterAll(async () => {
  /* Cascade deletes notes and subscriptions. */
  await prisma.user.deleteMany({
    where: { id: { in: [ownerId, strangerId, freeUserId, proUserId] } },
  });
  await prisma.$disconnect();
});

describe("note ownership", () => {
  it("does not let another account read a note", async () => {
    const note = await createNote(ownerId, {
      title: "Private",
      description: "Only the owner should see this.",
    });

    expect(await getNote(ownerId, note.id)).not.toBeNull();
    expect(await getNote(strangerId, note.id)).toBeNull();
  });

  it("does not let another account update a note", async () => {
    const note = await createNote(ownerId, {
      title: "Original",
      description: "Original content",
    });

    await expect(
      updateNote(strangerId, note.id, {
        title: "Hijacked",
        description: "Hijacked content",
      })
    ).rejects.toBeInstanceOf(NoteNotFoundError);

    const unchanged = await getNote(ownerId, note.id);
    expect(unchanged?.title).toBe("Original");
  });

  it("does not let another account delete a note", async () => {
    const note = await createNote(ownerId, {
      title: "Keep me",
      description: "Still here",
    });

    await expect(deleteNote(strangerId, note.id)).rejects.toBeInstanceOf(
      NoteNotFoundError
    );

    expect(await getNote(ownerId, note.id)).not.toBeNull();
  });

  it("lets the owner update and delete the note", async () => {
    const note = await createNote(ownerId, {
      title: "Mine",
      description: "Mine",
    });

    await updateNote(ownerId, note.id, {
      title: "Mine, edited",
      description: "Mine, edited",
    });

    expect((await getNote(ownerId, note.id))?.title).toBe("Mine, edited");

    await deleteNote(ownerId, note.id);

    expect(await getNote(ownerId, note.id)).toBeNull();
  });
});

describe("input validation", () => {
  it("rejects a blank title", async () => {
    await expect(
      createNote(ownerId, { title: "   ", description: "content" })
    ).rejects.toBeInstanceOf(ZodError);
  });

  it("rejects content over the limit", async () => {
    await expect(
      createNote(ownerId, { title: "Big", description: "x".repeat(50_001) })
    ).rejects.toBeInstanceOf(ZodError);
  });

  it("trims surrounding whitespace", async () => {
    const note = await createNote(ownerId, {
      title: "  Trimmed  ",
      description: "  body  ",
    });

    expect(note.title).toBe("Trimmed");
    expect(note.description).toBe("body");
  });
});

describe("free plan limit", () => {
  it("has no limit for accounts with an active subscription", async () => {
    const now = Math.floor(Date.now() / 1000);

    await prisma.subscription.create({
      data: {
        userId: proUserId,
        stripeSubscriptionId: `sub_test_${suffix}`,
        status: "active",
        planId: "price_test",
        interval: "month",
        currentPeriodStart: now,
        currentPeriodEnd: now + 30 * 24 * 60 * 60,
      },
    });

    await prisma.note.createMany({
      data: Array.from({ length: FREE_NOTE_LIMIT }, (_, index) => ({
        title: `Pro note ${index}`,
        description: "content",
        userId: proUserId,
      })),
    });

    await expect(
      createNote(proUserId, { title: "Beyond the free limit", description: "ok" })
    ).resolves.toMatchObject({ title: "Beyond the free limit" });
  });

  it("blocks a free account once it reaches the limit", async () => {
    expect(
      isFreePlanLimitReached(FREE_NOTE_LIMIT, false)
    ).toBe(true);
    expect(isFreePlanLimitReached(FREE_NOTE_LIMIT, true)).toBe(false);

    await prisma.note.createMany({
      data: Array.from({ length: FREE_NOTE_LIMIT }, (_, index) => ({
        title: `Free note ${index}`,
        description: "content",
        userId: freeUserId,
      })),
    });

    expect(await countNotes(freeUserId)).toBe(FREE_NOTE_LIMIT);

    await expect(
      createNote(freeUserId, { title: "One too many", description: "nope" })
    ).rejects.toBeInstanceOf(NoteLimitError);
  });
});
