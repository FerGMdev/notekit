import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import prisma from "@/app/lib/db";
import { createNote, getNote, NoteNotFoundError, trashNote } from "@/app/lib/notes";
import {
  createShareLink,
  getSharedNote,
  revokeShareLink,
} from "@/app/lib/sharing";

/**
 * Sharing is a capability in the URL, which makes it exactly the kind of
 * feature that needs tests: a revoked or deleted note must stop resolving even
 * if someone kept the link.
 */

const suffix = randomUUID();
const ownerId = `share-owner-${suffix}`;
const strangerId = `share-stranger-${suffix}`;

beforeAll(async () => {
  await prisma.user.createMany({
    data: [
      { id: ownerId, email: `${ownerId}@example.test`, name: "Owner" },
      { id: strangerId, email: `${strangerId}@example.test`, name: "Stranger" },
    ],
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({
    where: { id: { in: [ownerId, strangerId] } },
  });
  await prisma.$disconnect();
});

async function makeNote() {
  return createNote(ownerId, {
    title: "Public note",
    description: "Content that can be shared.",
  });
}

describe("share links", () => {
  it("creates an unguessable token that resolves publicly", async () => {
    const note = await makeNote();
    const shareId = await createShareLink(ownerId, note.id);

    expect(shareId.length).toBeGreaterThanOrEqual(16);

    const shared = await getSharedNote(shareId);
    expect(shared?.id).toBe(note.id);
    expect(shared?.title).toBe("Public note");
  });

  it("is idempotent while the link is active", async () => {
    const note = await makeNote();
    const first = await createShareLink(ownerId, note.id);
    const second = await createShareLink(ownerId, note.id);

    expect(second).toBe(first);
  });

  it("gives each note its own token", async () => {
    const [a, b] = await Promise.all([makeNote(), makeNote()]);

    const [tokenA, tokenB] = await Promise.all([
      createShareLink(ownerId, a.id),
      createShareLink(ownerId, b.id),
    ]);

    expect(tokenA).not.toBe(tokenB);
  });

  it("stops resolving after revoke", async () => {
    const note = await makeNote();
    const shareId = await createShareLink(ownerId, note.id);

    await revokeShareLink(ownerId, note.id);

    expect(await getSharedNote(shareId)).toBeNull();
    expect((await getNote(ownerId, note.id))?.shareId).toBeNull();
  });

  it("stops resolving when the note is trashed", async () => {
    const note = await makeNote();
    const shareId = await createShareLink(ownerId, note.id);

    await trashNote(ownerId, note.id);

    expect(await getSharedNote(shareId)).toBeNull();
  });

  it("cannot be created for a trashed note", async () => {
    const note = await makeNote();
    await trashNote(ownerId, note.id);

    await expect(
      createShareLink(ownerId, note.id)
    ).rejects.toBeInstanceOf(NoteNotFoundError);
  });

  it("cannot be created by someone else", async () => {
    const note = await makeNote();

    await expect(
      createShareLink(strangerId, note.id)
    ).rejects.toBeInstanceOf(NoteNotFoundError);

    expect((await getNote(ownerId, note.id))?.shareId).toBeNull();
  });

  it("cannot be revoked by someone else", async () => {
    const note = await makeNote();
    const shareId = await createShareLink(ownerId, note.id);

    await expect(
      revokeShareLink(strangerId, note.id)
    ).rejects.toBeInstanceOf(NoteNotFoundError);

    expect(await getSharedNote(shareId)).not.toBeNull();
  });
});
