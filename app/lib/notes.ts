import { z } from "zod";
import prisma from "./db";
import {
  FREE_NOTE_LIMIT,
  hasActiveSubscription,
  isFreePlanLimitReached,
} from "./billing";

/**
 * Note domain layer.
 *
 * Every read and write takes a `userId` and filters by it in the query itself,
 * so "user B can touch user A's note" is impossible by construction rather
 * than by remembering to check it in each page. Server actions become thin
 * wrappers around these functions.
 */

export const noteInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title cannot be empty")
    .max(120, "Title must be 120 characters or fewer"),
  description: z
    .string()
    .trim()
    .min(1, "Content cannot be empty")
    .max(50_000, "Content must be 50,000 characters or fewer"),
});

export type NoteInput = z.infer<typeof noteInputSchema>;

export type NoteSummary = {
  id: string;
  title: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
};

export class NoteLimitError extends Error {
  readonly limit = FREE_NOTE_LIMIT;

  constructor() {
    super(
      `You reached the free plan limit of ${FREE_NOTE_LIMIT} notes. Upgrade to Pro to keep writing.`
    );
    this.name = "NoteLimitError";
  }
}

export class NoteNotFoundError extends Error {
  constructor() {
    super("Note not found");
    this.name = "NoteNotFoundError";
  }
}

const noteSelect = {
  id: true,
  title: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function listNotes(userId: string): Promise<NoteSummary[]> {
  return prisma.note.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: noteSelect,
  });
}

export async function getNote(
  userId: string,
  noteId: string
): Promise<NoteSummary | null> {
  return prisma.note.findFirst({
    where: { id: noteId, userId },
    select: noteSelect,
  });
}

export async function countNotes(userId: string) {
  return prisma.note.count({ where: { userId } });
}

/** Whether the account may create one more note. Used to render the UI. */
export async function canCreateNote(userId: string) {
  const [noteCount, isPro] = await Promise.all([
    countNotes(userId),
    hasActiveSubscription(userId),
  ]);

  return !isFreePlanLimitReached(noteCount, isPro);
}

/** `input` is `unknown` on purpose: server actions receive untrusted form data. */
export async function createNote(
  userId: string,
  input: unknown
): Promise<NoteSummary> {
  const data = noteInputSchema.parse(input);

  const [noteCount, isPro] = await Promise.all([
    countNotes(userId),
    hasActiveSubscription(userId),
  ]);

  if (isFreePlanLimitReached(noteCount, isPro)) {
    throw new NoteLimitError();
  }

  return prisma.note.create({
    data: { ...data, userId },
    select: noteSelect,
  });
}

export async function updateNote(
  userId: string,
  noteId: string,
  input: unknown
): Promise<void> {
  const data = noteInputSchema.parse(input);

  // `updateMany` with both id and userId is a single atomic statement: it
  // cannot be tricked into updating a row owned by someone else.
  const { count } = await prisma.note.updateMany({
    where: { id: noteId, userId },
    data,
  });

  if (count === 0) {
    throw new NoteNotFoundError();
  }
}

export async function deleteNote(userId: string, noteId: string): Promise<void> {
  const { count } = await prisma.note.deleteMany({
    where: { id: noteId, userId },
  });

  if (count === 0) {
    throw new NoteNotFoundError();
  }
}
