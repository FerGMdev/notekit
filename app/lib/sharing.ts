import { randomBytes } from "node:crypto";
import prisma from "./db";
import { NoteNotFoundError, noteSummarySelect, type NoteSummary } from "./notes";

/**
 * Public sharing.
 *
 * A share link is a random token stored on the note. No token means private:
 * revoking is a plain `shareId = null`, and every read path checks both the
 * token and `deletedAt`, so a trashed note can never leak through an old link.
 */

const SHARE_ID_BYTES = 12; // 16 URL-safe characters, unguessable.

export async function createShareLink(
  userId: string,
  noteId: string
): Promise<string> {
  const note = await prisma.note.findFirst({
    where: { id: noteId, userId, deletedAt: null },
    select: { shareId: true },
  });

  if (!note) {
    throw new NoteNotFoundError();
  }

  if (note.shareId) {
    return note.shareId;
  }

  const shareId = randomBytes(SHARE_ID_BYTES).toString("base64url");

  const { count } = await prisma.note.updateMany({
    where: { id: noteId, userId, deletedAt: null },
    data: { shareId, sharedAt: new Date() },
  });

  if (count === 0) {
    throw new NoteNotFoundError();
  }

  /* Re-read so a concurrent request that won the race returns its token. */
  const current = await prisma.note.findFirst({
    where: { id: noteId, userId },
    select: { shareId: true },
  });

  return current?.shareId ?? shareId;
}

export async function revokeShareLink(
  userId: string,
  noteId: string
): Promise<void> {
  const { count } = await prisma.note.updateMany({
    where: { id: noteId, userId },
    data: { shareId: null, sharedAt: null },
  });

  if (count === 0) {
    throw new NoteNotFoundError();
  }
}

/**
 * Unauthenticated read: the token is the capability.
 *
 * `generateMetadata` and the page each call this, so a share view costs two
 * indexed lookups on `shareId`. Cheaper than caching a capability that can be
 * revoked at any moment.
 */
export async function getSharedNote(
  shareId: string
): Promise<NoteSummary | null> {
  return prisma.note.findFirst({
    where: { shareId, deletedAt: null },
    select: noteSummarySelect,
  });
}
